import "server-only";

import type { Json } from "@/db/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  readCitations,
  type ConversationStore,
  type StoredMessage,
} from "./conversation-store";

/** Carries the Postgres error code only. Messages can quote row values. */
class ConversationStoreError extends Error {
  constructor(readonly code: string) {
    super("CONVERSATION_STORE_FAILED");
    this.name = "ConversationStoreError";
  }
}

function check<Data>(result: {
  data: Data | null;
  error: { code: string } | null;
}): Data {
  if (result.error) throw new ConversationStoreError(result.error.code);
  if (result.data === null) throw new ConversationStoreError("NO_DATA");
  return result.data;
}

function first<Row>(rows: Row[]): Row {
  const row = rows[0];
  if (!row) throw new ConversationStoreError("NO_ROW");
  return row;
}

/** The generated types mark every parameter as non-null; null is real here. */
const nullable = <Value>(value: Value | null) => value as Value;

export const supabaseConversationStore: ConversationStore = {
  async attachVisitor({ widgetSessionId, secretHash, newSecretHash }) {
    const row = first(
      check(
        await createAdminClient().rpc("widget_attach_visitor", {
          p_widget_session_id: widgetSessionId,
          p_secret_hash: nullable(secretHash),
          p_new_secret_hash: newSecretHash,
        }),
      ),
    );
    if (row.outcome !== "allowed") return { outcome: "denied" };
    return {
      outcome: "allowed",
      visitorId: row.visitor_id,
      resumed: row.resumed,
      memoryConsent: row.memory_consent,
      conversationId: row.conversation_id ?? null,
    };
  },

  async postMessage({ widgetSessionId, clientMessageId, body }) {
    const row = first(
      check(
        await createAdminClient().rpc("widget_post_message", {
          p_widget_session_id: widgetSessionId,
          p_client_message_id: clientMessageId,
          p_body: body,
        }),
      ),
    );
    switch (row.outcome) {
      case "claimed":
        return {
          outcome: "claimed",
          conversationId: row.conversation_id,
          messageId: row.message_id,
          replyId: row.reply_id,
        };
      case "duplicate":
        return {
          outcome: "duplicate",
          conversationId: row.conversation_id,
          messageId: row.message_id,
          replyId: row.reply_id,
          body: row.reply_body ?? "",
          citations: readCitations(row.reply_citations),
          handoff: row.reply_handoff === true,
        };
      case "in_progress":
        return {
          outcome: "in_progress",
          conversationId: row.conversation_id,
          replyId: row.reply_id ?? null,
        };
      case "rate_limited":
        return {
          outcome: "rate_limited",
          retryAfter: Math.max(1, row.retry_after),
        };
      case "invalid":
      case "spam":
      case "limit_reached":
      case "failed":
        return { outcome: row.outcome };
      default:
        return { outcome: "denied" };
    }
  },

  async completeReply(input) {
    return check(
      await createAdminClient().rpc("widget_complete_reply", {
        p_reply_id: input.replyId,
        p_status: input.status,
        p_body: input.body,
        p_citations: input.citations as unknown as Json,
        p_handoff: input.handoff,
        p_prompt_version: nullable(input.promptVersion),
      }),
    );
  },

  async conversation({ widgetSessionId, limit }) {
    const rows = check(
      await createAdminClient().rpc("widget_conversation", {
        p_widget_session_id: widgetSessionId,
        p_limit: limit,
      }),
    );
    const head = rows[0];
    return {
      conversationId: head?.conversation_id ?? null,
      summary: head?.summary ?? null,
      summarizedThrough: head?.summarized_through ?? null,
      memoryConsent: head?.memory_consent ?? false,
      messages: rows.map<StoredMessage>((row) => ({
        id: row.message_id,
        role: row.role === "assistant" ? "assistant" : "visitor",
        clientMessageId: row.client_message_id ?? null,
        replyTo: row.reply_to ?? null,
        status:
          row.status === "pending" || row.status === "failed"
            ? row.status
            : "completed",
        body: row.body,
        citations: readCitations(row.citations),
        handoff: row.handoff,
        feedback:
          row.feedback === 1 || row.feedback === -1 ? row.feedback : null,
        createdAt: row.created_at,
      })),
    };
  },

  async updateSummary({ conversationId, summary, through }) {
    return check(
      await createAdminClient().rpc("widget_update_summary", {
        p_conversation_id: conversationId,
        p_summary: summary,
        p_through: through,
      }),
    );
  },

  async setFeedback({ widgetSessionId, messageId, value }) {
    return check(
      await createAdminClient().rpc("widget_set_feedback", {
        p_widget_session_id: widgetSessionId,
        p_message_id: messageId,
        p_value: nullable(value),
      }),
    );
  },

  async setMemoryConsent({ widgetSessionId, granted, textVersion }) {
    return check(
      await createAdminClient().rpc("widget_set_memory_consent", {
        p_widget_session_id: widgetSessionId,
        p_granted: granted,
        p_text_version: textVersion,
      }),
    );
  },

  async siteProfile(siteId) {
    const { data, error } = await createAdminClient()
      .from("sites")
      .select("public_name, widget_title")
      .eq("id", siteId)
      .maybeSingle();
    if (error) throw new ConversationStoreError(error.code);
    return data ? { name: data.public_name, title: data.widget_title } : null;
  },
};
