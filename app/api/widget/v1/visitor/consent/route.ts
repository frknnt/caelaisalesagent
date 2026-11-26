import { handleMemoryConsent } from "@/lib/widget/conversation";
import { conversationRoute } from "@/lib/widget/conversation-route";

export const dynamic = "force-dynamic";

export const POST = conversationRoute(
  "/api/widget/v1/visitor/consent",
  handleMemoryConsent,
);
