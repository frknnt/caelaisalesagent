import { createHash } from "node:crypto";

import type { AgentTurnResult } from "@/lib/agent/loop";
import {
  buildConversationWindow,
  type ConversationTurn,
} from "@/lib/agent/prompt";
import { foldIntoSummary } from "@/lib/agent/summary";
import type { Logger } from "@/lib/observability/logger";

import {
  readCitations,
  type ConversationStore,
  type StoredCitation,
  type StoredMessage,
} from "./conversation-store";
import {
  baseHeaders,
  limited,
  parseRecord,
  problem,
  readSmallBody,
  requireWidgetSession,
  type WidgetDeps,
  type WidgetSessionContext,
} from "./handlers";

/** Version of the memory consent text the visitor saw (see `copy.ts`). */
export const MEMORY_CONSENT_VERSION = "memory-2026-11-26";
export const MESSAGE_MAX_CHARS = 1000;
/** Model window; must match what the agent loop uses. */
export const WINDOW_TURNS = 12;
export const WINDOW_CHARS = 12_000;
const HISTORY_LIMIT = 60;
const MESSAGE_BODY_BYTES = 8192;

const visitorKeyPattern = /^[A-Za-z0-9_-]{43}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type AgentRunner = (input: {
  session: WidgetSessionContext;
  turnId: string;
  siteName: string;
  agentName: string;
  history: readonly ConversationTurn[];
  summary: string | null;
  logger: Logger;
  onTextDelta: (delta: string) => void;
}) => Promise<AgentTurnResult>;

export interface ConversationDeps extends WidgetDeps {
  conversations: ConversationStore;
  runAgent: AgentRunner;
}

const hashKey = (key: string) =>
  createHash("sha256").update(key).digest("base64url");

/** What a visitor may see of a stored message. */
function visible(message: StoredMessage) {
  return {
    id: message.id,
    role: message.role,
    clientMessageId: message.clientMessageId,
    replyTo: message.replyTo,
    status: message.status,
    text: message.body,
    citations: message.citations,
    handoff: message.handoff,
    feedback: message.feedback,
  };
}

async function readJson(request: Request, maxBytes?: number) {
  const type = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:;|$)/i.test(type)) return "type" as const;
  const body = await readSmallBody(request, maxBytes);
  if (body === null) return "size" as const;
  return parseRecord(body);
}

function badJson(result: "type" | "size" | null) {
  if (result === "type") return problem(415, "WIDGET_BAD_REQUEST");
  if (result === "size") return problem(413, "WIDGET_BAD_REQUEST");
  return problem(400, "WIDGET_BAD_REQUEST");
}

/**
 * POST /api/widget/v1/visitor. Binds this session to an anonymous visitor and
 * returns the open conversation. `key` is a secret the frame kept from before
 * (tab storage, or device storage only with memory consent); `fresh` is a new
 * random secret the frame proposes, so a retried call is idempotent.
 */
export async function handleAttachVisitor(
  request: Request,
  deps: ConversationDeps,
): Promise<Response> {
  const guard = await requireWidgetSession(request, deps);
  if (!guard.ok) return guard.response;
  const json = await readJson(request);
  if (json === null || typeof json === "string") return badJson(json);
  const { key, fresh } = json;
  if (
    typeof fresh !== "string" ||
    !visitorKeyPattern.test(fresh) ||
    (key !== null &&
      key !== undefined &&
      (typeof key !== "string" || !visitorKeyPattern.test(key)))
  ) {
    return problem(400, "WIDGET_BAD_REQUEST");
  }
  const known = typeof key === "string" && key !== fresh ? key : null;
  const attached = await deps.conversations.attachVisitor({
    widgetSessionId: guard.session.sessionId,
    secretHash: known ? hashKey(known) : null,
    newSecretHash: hashKey(fresh),
  });
  if (attached.outcome !== "allowed") return problem(403, "WIDGET_DENIED");
  const snapshot = attached.conversationId
    ? await deps.conversations.conversation({
        widgetSessionId: guard.session.sessionId,
        limit: HISTORY_LIMIT,
      })
    : null;
  deps.logger.info("widget.visitor_attached", {
    widgetId: guard.session.sessionId,
    resumed: attached.resumed,
    memoryConsent: attached.memoryConsent,
  });
  return Response.json(
    {
      key: attached.resumed && known ? known : fresh,
      resumed: attached.resumed,
      memoryConsent: attached.memoryConsent,
      messages: (snapshot?.messages ?? []).map(visible),
    },
    { headers: baseHeaders },
  );
}

/** GET /api/widget/v1/conversation: the open conversation, e.g. after a reconnect. */
export async function handleConversation(
  request: Request,
  deps: ConversationDeps,
): Promise<Response> {
  const guard = await requireWidgetSession(request, deps);
  if (!guard.ok) return guard.response;
  let snapshot;
  try {
    snapshot = await deps.conversations.conversation({
      widgetSessionId: guard.session.sessionId,
      limit: HISTORY_LIMIT,
    });
  } catch {
    return problem(409, "WIDGET_VISITOR_REQUIRED");
  }
  return Response.json(
    {
      memoryConsent: snapshot.memoryConsent,
      messages: snapshot.messages.map(visible),
    },
    { headers: baseHeaders },
  );
}

/** POST /api/widget/v1/visitor/consent: memory across visits, yes or no. */
export async function handleMemoryConsent(
  request: Request,
  deps: ConversationDeps,
): Promise<Response> {
  const guard = await requireWidgetSession(request, deps);
  if (!guard.ok) return guard.response;
  const json = await readJson(request);
  if (json === null || typeof json === "string") return badJson(json);
  if (
    typeof json.granted !== "boolean" ||
    json.version !== MEMORY_CONSENT_VERSION
  ) {
    return problem(400, "WIDGET_BAD_REQUEST");
  }
  const saved = await deps.conversations.setMemoryConsent({
    widgetSessionId: guard.session.sessionId,
    granted: json.granted,
    textVersion: MEMORY_CONSENT_VERSION,
  });
  if (!saved) return problem(409, "WIDGET_VISITOR_REQUIRED");
  deps.logger.info("widget.memory_consent", { granted: json.granted });
  return Response.json(
    { memoryConsent: json.granted },
    { headers: baseHeaders },
  );
}

/** POST /api/widget/v1/feedback: thumbs up, down or cleared on one reply. */
export async function handleFeedback(
  request: Request,
  deps: ConversationDeps,
): Promise<Response> {
  const guard = await requireWidgetSession(request, deps);
  if (!guard.ok) return guard.response;
  const json = await readJson(request);
  if (json === null || typeof json === "string") return badJson(json);
  const { messageId, value } = json;
  if (
    typeof messageId !== "string" ||
    !uuidPattern.test(messageId) ||
    !(value === 1 || value === -1 || value === null)
  ) {
    return problem(400, "WIDGET_BAD_REQUEST");
  }
  const saved = await deps.conversations.setFeedback({
    widgetSessionId: guard.session.sessionId,
    messageId,
    value,
  });
  if (!saved) return problem(404, "WIDGET_BAD_REQUEST");
  return Response.json({ feedback: value }, { headers: baseHeaders });
}

/** Completed turns, oldest first, without the reply being written now. */
export function turnMessages(
  messages: readonly StoredMessage[],
  pendingReplyId: string,
): StoredMessage[] {
  return messages.filter(
    (message) =>
      message.role === "visitor" ||
      (message.id !== pendingReplyId &&
        message.status === "completed" &&
        message.body !== ""),
  );
}

const toTurn = (message: StoredMessage): ConversationTurn => ({
  role: message.role === "visitor" ? "user" : "assistant",
  content: message.body,
});

function citationsOf(result: AgentTurnResult): {
  citations: StoredCitation[];
  handoff: boolean;
} {
  if (result.status !== "answered") return { citations: [], handoff: true };
  let citations: StoredCitation[] = [];
  let handoff = false;
  for (const { tool, output } of result.toolOutputs) {
    if (tool !== "search_knowledge" || !output || typeof output !== "object")
      continue;
    const value = output as { citations?: unknown; handoff?: unknown };
    citations = readCitations(value.citations);
    handoff = value.handoff === true;
  }
  return { citations, handoff };
}

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const streamHeaders = {
  ...baseHeaders,
  "Cache-Control": "no-store, no-transform",
  "Content-Type": "text/event-stream; charset=utf-8",
  "X-Accel-Buffering": "no",
};

/**
 * POST /api/widget/v1/messages. Stores the visitor's message under the id the
 * browser chose and streams the one reply as server-sent events: `accepted`,
 * `delta` (display only), then `reply` (authoritative) or `error`. A resend of
 * the same id gets the stored reply, or 202 while it is still being written.
 */
export async function handlePostMessage(
  request: Request,
  deps: ConversationDeps,
): Promise<Response> {
  const guard = await requireWidgetSession(request, deps);
  if (!guard.ok) return guard.response;
  const json = await readJson(request, MESSAGE_BODY_BYTES);
  if (json === null || typeof json === "string") return badJson(json);
  const { clientMessageId, text, attachments } = json;
  if (attachments !== undefined)
    return problem(400, "WIDGET_ATTACHMENTS_UNSUPPORTED");
  if (
    typeof clientMessageId !== "string" ||
    !uuidPattern.test(clientMessageId)
  ) {
    return problem(400, "WIDGET_BAD_REQUEST");
  }
  if (
    typeof text !== "string" ||
    !text.trim() ||
    [...text].length > MESSAGE_MAX_CHARS
  ) {
    return problem(400, "WIDGET_MESSAGE_INVALID");
  }
  // Control characters other than line breaks carry nothing a visitor typed.
  const body = text
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!body) return problem(400, "WIDGET_MESSAGE_INVALID");

  const { session } = guard;
  const posted = await deps.conversations.postMessage({
    widgetSessionId: session.sessionId,
    clientMessageId,
    body,
  });
  switch (posted.outcome) {
    case "denied":
      return problem(409, "WIDGET_VISITOR_REQUIRED");
    case "invalid":
      return problem(400, "WIDGET_MESSAGE_INVALID");
    case "spam":
      deps.logger.info("widget.message_repeated", {
        widgetId: session.sessionId,
      });
      return problem(429, "WIDGET_MESSAGE_REPEATED");
    case "rate_limited":
      deps.logger.warn("widget.rate_limited", { stage: "message" });
      return limited(posted.retryAfter);
    case "limit_reached":
      return problem(409, "WIDGET_LIMIT_REACHED");
    case "failed":
      return problem(503, "WIDGET_REPLY_FAILED");
    case "in_progress":
      return Response.json(
        { status: "in_progress" },
        { status: 202, headers: baseHeaders },
      );
    case "duplicate":
      return new Response(
        new Blob([
          sse("accepted", {
            messageId: posted.messageId,
            replyId: posted.replyId,
          }),
          sse("reply", {
            replyId: posted.replyId,
            text: posted.body,
            citations: posted.citations,
            handoff: posted.handoff,
            duplicate: true,
          }),
        ]).stream(),
        { headers: streamHeaders },
      );
    case "claimed":
      break;
  }

  const { replyId, messageId } = posted;
  const logger = deps.logger;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(sse(event, data));
        } catch {
          // The visitor went away. The reply is still stored for a reload.
          open = false;
        }
      };
      send("accepted", { messageId, replyId });
      try {
        const [snapshot, site] = await Promise.all([
          deps.conversations.conversation({
            widgetSessionId: session.sessionId,
            limit: HISTORY_LIMIT,
          }),
          deps.conversations.siteProfile(session.siteId),
        ]);
        const fresh = snapshot.summarizedThrough
          ? snapshot.messages.filter(
              (message) =>
                Date.parse(message.createdAt) >
                Date.parse(snapshot.summarizedThrough!),
            )
          : snapshot.messages;
        const included = turnMessages(fresh, replyId);
        const history = included.map(toTurn);
        const window = buildConversationWindow({
          history,
          summary: snapshot.summary,
          maxTurns: WINDOW_TURNS,
          maxChars: WINDOW_CHARS,
        });
        let summary = snapshot.summary;
        if (window.dropped.length && snapshot.conversationId) {
          summary = foldIntoSummary(summary, window.dropped);
          // The newest stored message that left the window.
          const through = included[window.dropped.length - 1]?.createdAt;
          if (summary && through) {
            await deps.conversations.updateSummary({
              conversationId: snapshot.conversationId,
              summary,
              through,
            });
          }
        }
        const result = await deps.runAgent({
          session,
          turnId: replyId,
          siteName: site?.name ?? "",
          agentName: site?.title ?? "",
          history: history.slice(window.dropped.length),
          summary,
          logger,
          onTextDelta: (delta) => send("delta", { text: delta }),
        });
        const { citations, handoff } = citationsOf(result);
        await deps.conversations.completeReply({
          replyId,
          status: "completed",
          body: result.text,
          citations,
          handoff,
          promptVersion: result.promptVersion,
        });
        logger.info("widget.reply_completed", {
          status: result.status,
          steps: result.steps,
          citations: citations.length,
        });
        send("reply", { replyId, text: result.text, citations, handoff });
      } catch (error) {
        logger.error("widget.reply_failed", error);
        await deps.conversations
          .completeReply({
            replyId,
            status: "failed",
            body: "",
            citations: [],
            handoff: false,
            promptVersion: null,
          })
          .catch(() => undefined);
        send("error", { code: "WIDGET_REPLY_FAILED" });
      } finally {
        if (open) controller.close();
        open = false;
      }
    },
  });
  return new Response(stream, { headers: streamHeaders });
}
