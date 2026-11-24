import { Bot, CalendarCheck, Check } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";

/** Phone screen used in the hero: qualification inside a live conversation. */
export function ConversationMockup() {
  return (
    <div className="px-5 pt-6 pb-8 sm:px-7 sm:pt-7">
      <div className="flex items-center justify-between">
        <Avatar initials="MC" />
        <span className="bg-cyan text-ink inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9375rem] font-semibold">
          <Check className="size-4" strokeWidth={2.6} />
          Qualified
        </span>
      </div>

      <div className="mt-3 text-center">
        <p className="text-body">Maya Chen, Halden Studio</p>
        <p className="font-display mt-1 text-5xl leading-none font-semibold tracking-tight tabular-nums sm:text-[3.5rem]">
          86<span className="text-[#7b828d] text-2xl font-normal">/100</span>
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Badge tone="violet">High intent</Badge>
          <Badge>40 seats</Badge>
          <Badge>This quarter</Badge>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <p className="text-body flex items-center justify-center gap-2 text-sm">
          <Bot className="size-4" />
          You’re chatting with Cael, an AI agent
        </p>
        <MessageBubble from="visitor">
          Can we roll out to 40 reps this quarter?
        </MessageBubble>
        <MessageBubble from="agent" source="Rollout guide">
          Yes. Teams start with one channel, then add the rest.
        </MessageBubble>
        <div className="bg-amber text-ink flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[0.9375rem] font-semibold">
          <CalendarCheck className="size-5" />
          Offer Thursday, 2:00 PM
        </div>
      </div>
    </div>
  );
}
