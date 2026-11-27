import { timingSafeEqual } from "node:crypto";

import {
  claimInboxNotifications,
  completeInboxNotification,
  deliverInboxNotification,
  readInboxEmailConfig,
} from "@/lib/inbox/notifications";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.INBOX_NOTIFICATION_WORKER_TOKEN?.trim() ?? "";
  const received =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (expected.length < 32 || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const config = readInboxEmailConfig(process.env);
  if (!config)
    return Response.json({ error: "EMAIL_NOT_CONFIGURED" }, { status: 503 });

  const claimed = await claimInboxNotifications();
  let delivered = 0;
  for (const notification of claimed) {
    try {
      await deliverInboxNotification(notification, config);
      await completeInboxNotification(notification.id, true, null);
      delivered += 1;
    } catch (error) {
      const code =
        error instanceof Error && /^EMAIL_HTTP_\d{3}$/.test(error.message)
          ? error.message
          : "EMAIL_DELIVERY_FAILED";
      await completeInboxNotification(notification.id, false, code);
    }
  }
  return Response.json({ claimed: claimed.length, delivered });
}
