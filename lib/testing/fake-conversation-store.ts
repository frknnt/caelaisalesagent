import type {
  ConversationStore,
  PostResult,
  StoredMessage,
} from "@/lib/widget/conversation-store";

interface Visitor {
  id: string;
  siteId: string;
  hash: string;
  lastSeen: number;
  consent: boolean;
}

/**
 * In-memory stand-in for the SQL functions of P1.4. The real policy (limits,
 * resume window, tenant isolation) is SQL and tested in supabase/tests; this
 * mirrors the outcomes the handlers react to: one reply per message id.
 */
export function createFakeConversationStore({
  now,
  siteId = "a0000000-0000-4000-8000-000000000101",
}: {
  now: () => Date;
  siteId?: string;
}) {
  const visitors: Visitor[] = [];
  const bound = new Map<string, string>();
  const messages: (StoredMessage & { visitorId: string })[] = [];
  const consents: { visitorId: string; granted: boolean; version: string }[] =
    [];
  const summaries = new Map<string, { summary: string; through: string }>();
  let counter = 0;
  const id = (prefix: string) =>
    `${prefix}0000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
  const visitorOf = (session: string) =>
    visitors.find((visitor) => visitor.id === bound.get(session));
  const conversationOf = (visitor: Visitor) => `c-${visitor.id}`;
  const stamp = () => new Date(now().getTime() + counter).toISOString();

  const store: ConversationStore = {
    async attachVisitor({ widgetSessionId, secretHash, newSecretHash }) {
      let visitor = visitorOf(widgetSessionId);
      let resumed = false;
      if (!visitor) {
        const known = visitors.find(
          (candidate) =>
            candidate.siteId === siteId &&
            candidate.hash === secretHash &&
            (candidate.lastSeen > now().getTime() - 2 * 3600_000 ||
              candidate.consent),
        );
        resumed = Boolean(known);
        visitor = known ?? {
          id: id("e"),
          siteId,
          hash: newSecretHash,
          lastSeen: now().getTime(),
          consent: false,
        };
        if (!known) visitors.push(visitor);
        bound.set(widgetSessionId, visitor.id);
      }
      visitor.lastSeen = now().getTime();
      const has = messages.some((message) => message.visitorId === visitor.id);
      return {
        outcome: "allowed",
        visitorId: visitor.id,
        resumed,
        memoryConsent: visitor.consent,
        conversationId: has ? conversationOf(visitor) : null,
      };
    },

    async postMessage({
      widgetSessionId,
      clientMessageId,
      body,
    }): Promise<PostResult> {
      const visitor = visitorOf(widgetSessionId);
      if (!visitor) return { outcome: "denied" };
      const conversationId = conversationOf(visitor);
      const existing = messages.find(
        (message) =>
          message.visitorId === visitor.id &&
          message.clientMessageId === clientMessageId,
      );
      if (existing) {
        const reply = messages.find(
          (message) => message.replyTo === existing.id,
        );
        if (!reply) return { outcome: "failed" };
        if (reply.status === "completed")
          return {
            outcome: "duplicate",
            conversationId,
            messageId: existing.id,
            replyId: reply.id,
            body: reply.body,
            citations: reply.citations,
            handoff: reply.handoff,
          };
        if (reply.status === "pending")
          return { outcome: "in_progress", conversationId, replyId: reply.id };
        reply.status = "pending";
        return {
          outcome: "claimed",
          conversationId,
          messageId: existing.id,
          replyId: reply.id,
        };
      }
      const question: StoredMessage & { visitorId: string } = {
        id: id("d"),
        visitorId: visitor.id,
        role: "visitor",
        clientMessageId,
        replyTo: null,
        status: "completed",
        body,
        citations: [],
        handoff: false,
        feedback: null,
        createdAt: stamp(),
      };
      const reply: StoredMessage & { visitorId: string } = {
        ...question,
        id: id("b"),
        role: "assistant",
        clientMessageId: null,
        replyTo: question.id,
        status: "pending",
        body: "",
        createdAt: stamp(),
      };
      messages.push(question, reply);
      return {
        outcome: "claimed",
        conversationId,
        messageId: question.id,
        replyId: reply.id,
      };
    },

    async completeReply({ replyId, status, body, citations, handoff }) {
      const reply = messages.find((message) => message.id === replyId);
      if (!reply || reply.status !== "pending") return false;
      reply.status = status;
      reply.body = status === "completed" ? body : "";
      reply.citations = status === "completed" ? citations : [];
      reply.handoff = status === "completed" && handoff;
      return true;
    },

    async conversation({ widgetSessionId, limit }) {
      const visitor = visitorOf(widgetSessionId);
      if (!visitor) throw new Error("session_not_bound");
      const own = messages.filter(
        (message) => message.visitorId === visitor.id,
      );
      const conversationId = own.length ? conversationOf(visitor) : null;
      const summary = conversationId
        ? summaries.get(conversationId)
        : undefined;
      return {
        conversationId,
        summary: summary?.summary ?? null,
        summarizedThrough: summary?.through ?? null,
        memoryConsent: visitor.consent,
        messages: own
          .slice(-limit)
          .map(({ visitorId, ...message }) => (void visitorId, message)),
      };
    },

    async updateSummary({ conversationId, summary, through }) {
      const known = summaries.get(conversationId);
      if (known && known.through >= through) return false;
      summaries.set(conversationId, { summary, through });
      return true;
    },

    async setFeedback({ widgetSessionId, messageId, value }) {
      const visitor = visitorOf(widgetSessionId);
      const message = messages.find(
        (candidate) =>
          candidate.id === messageId &&
          candidate.role === "assistant" &&
          candidate.visitorId === visitor?.id,
      );
      if (!message) return false;
      message.feedback = value;
      return true;
    },

    async setMemoryConsent({ widgetSessionId, granted, textVersion }) {
      const visitor = visitorOf(widgetSessionId);
      if (!visitor) return false;
      visitor.consent = granted;
      consents.push({ visitorId: visitor.id, granted, version: textVersion });
      return true;
    },

    async siteProfile() {
      return { name: "Tenant A Main", title: "Tenant A satış asistanı" };
    },
  };

  return {
    store,
    visitors,
    messages,
    consents,
    summaries,
    age: (ms: number) => {
      for (const visitor of visitors) visitor.lastSeen -= ms;
    },
  };
}
