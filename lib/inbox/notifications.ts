import "server-only";

import type { Json } from "@/db/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface InboxNotification {
  id: string;
  conversationId: string;
  recipientEmail: string;
  template: "handoff" | "sla_reminder";
}

export function readInboxEmailConfig(
  env: Readonly<Record<string, string | undefined>>,
): { url: string; token: string } | null {
  const raw = env.INBOX_EMAIL_WEBHOOK_URL?.trim();
  const token = env.INBOX_EMAIL_WEBHOOK_TOKEN?.trim();
  if (!raw || !token || token.length < 32) return null;
  try {
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
      return null;
    return { url: url.toString(), token };
  } catch {
    return null;
  }
}

export async function claimInboxNotifications(limit = 25) {
  const { data, error } = await createAdminClient().rpc(
    "claim_inbox_notifications",
    { p_limit: limit },
  );
  if (error) throw new Error(`INBOX_NOTIFICATION_CLAIM_${error.code}`);
  return (data ?? []).map<InboxNotification>((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    recipientEmail: row.recipient_email,
    template: row.template === "sla_reminder" ? "sla_reminder" : "handoff",
  }));
}

export async function completeInboxNotification(
  id: string,
  delivered: boolean,
  errorCode: string | null,
) {
  const { error } = await createAdminClient().rpc(
    "complete_inbox_notification",
    {
      p_id: id,
      p_delivered: delivered,
      p_error_code: errorCode as unknown as string,
    },
  );
  if (error) throw new Error(`INBOX_NOTIFICATION_COMPLETE_${error.code}`);
}

export async function deliverInboxNotification(
  notification: InboxNotification,
  config: { url: string; token: string },
) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to: notification.recipientEmail,
      template: notification.template,
      conversationId: notification.conversationId,
    } satisfies Json),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`EMAIL_HTTP_${response.status}`);
}
