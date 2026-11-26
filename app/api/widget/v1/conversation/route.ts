import { handleConversation } from "@/lib/widget/conversation";
import { conversationRoute } from "@/lib/widget/conversation-route";

export const dynamic = "force-dynamic";

export const GET = conversationRoute(
  "/api/widget/v1/conversation",
  handleConversation,
);
