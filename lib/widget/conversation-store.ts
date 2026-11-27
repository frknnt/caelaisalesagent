/** Database side of widget conversations. The service role calls it, never a browser. */

export interface StoredCitation {
  sourceId: string;
  title: string;
  url: string | null;
}

export interface StoredMessage {
  id: string;
  role: "visitor" | "assistant";
  clientMessageId: string | null;
  replyTo: string | null;
  status: "pending" | "completed" | "failed";
  body: string;
  citations: StoredCitation[];
  handoff: boolean;
  feedback: -1 | 1 | null;
  createdAt: string;
}

export interface ConversationSnapshot {
  conversationId: string | null;
  summary: string | null;
  summarizedThrough: string | null;
  memoryConsent: boolean;
  messages: StoredMessage[];
}

export type AttachResult =
  | {
      outcome: "allowed";
      visitorId: string;
      resumed: boolean;
      memoryConsent: boolean;
      conversationId: string | null;
    }
  | { outcome: "denied" };

export type PostResult =
  | {
      outcome: "claimed";
      conversationId: string;
      messageId: string;
      replyId: string;
    }
  | {
      outcome: "duplicate";
      conversationId: string;
      messageId: string;
      replyId: string;
      body: string;
      citations: StoredCitation[];
      handoff: boolean;
    }
  | { outcome: "in_progress"; conversationId: string; replyId: string | null }
  | { outcome: "human_active"; conversationId: string; messageId: string }
  | { outcome: "rate_limited"; retryAfter: number }
  | {
      outcome: "denied" | "invalid" | "spam" | "limit_reached" | "failed";
    };

export interface ConversationStore {
  attachVisitor(input: {
    widgetSessionId: string;
    secretHash: string | null;
    newSecretHash: string;
  }): Promise<AttachResult>;
  postMessage(input: {
    widgetSessionId: string;
    clientMessageId: string;
    body: string;
  }): Promise<PostResult>;
  completeReply(input: {
    replyId: string;
    status: "completed" | "failed";
    body: string;
    citations: StoredCitation[];
    handoff: boolean;
    promptVersion: string | null;
  }): Promise<boolean>;
  recordToolEvents(input: {
    conversationId: string;
    messageId: string;
    events: Array<{
      toolName: string;
      outcome: "success" | "failure";
      summary: Record<string, string | number | boolean | null>;
    }>;
  }): Promise<void>;
  requestAgentHandoff(conversationId: string): Promise<boolean>;
  conversation(input: {
    widgetSessionId: string;
    limit: number;
  }): Promise<ConversationSnapshot>;
  updateSummary(input: {
    conversationId: string;
    summary: string;
    through: string;
  }): Promise<boolean>;
  setFeedback(input: {
    widgetSessionId: string;
    messageId: string;
    value: -1 | 1 | null;
  }): Promise<boolean>;
  setMemoryConsent(input: {
    widgetSessionId: string;
    granted: boolean;
    textVersion: string;
  }): Promise<boolean>;
  siteProfile(siteId: string): Promise<{ name: string; title: string } | null>;
}

/** Only the fields a visitor may see; anything else in stored JSON is dropped. */
export function readCitations(value: unknown): StoredCitation[] {
  if (!Array.isArray(value)) return [];
  const result: StoredCitation[] = [];
  for (const item of value.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const { sourceId, title, url } = item as Record<string, unknown>;
    if (typeof sourceId !== "string" || typeof title !== "string") continue;
    const safeUrl =
      typeof url === "string" && /^https?:\/\//i.test(url) ? url : null;
    if (result.some((known) => known.sourceId === sourceId)) continue;
    result.push({ sourceId, title: title.slice(0, 200), url: safeUrl });
  }
  return result;
}
