import { Bot, CircleCheck, Hand } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { BrowserMockup } from "@/components/ui/BrowserMockup";
import { cn } from "@/lib/cn";

import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";

const threads = [
  {
    initials: "MC",
    name: "Maya Chen",
    preview: "Can we roll out to 40 reps?",
    state: "Qualified",
    tone: "violet" as const,
    active: true,
  },
  {
    initials: "LB",
    name: "Leo Brandt",
    preview: "Is there a Pipedrive sync?",
    state: "AI agent",
    tone: "cyan" as const,
    active: false,
  },
  {
    initials: "PN",
    name: "Priya Nair",
    preview: "Please have someone call me",
    state: "With a rep",
    tone: "amber" as const,
    active: false,
  },
];

const context = [
  { label: "Company", value: "Halden Studio" },
  { label: "Stage", value: "Qualified" },
  { label: "Owner", value: "Jonas, Enterprise" },
  { label: "Channel", value: "Website chat" },
];

const activity = [
  "Asked about rollout",
  "Score passed threshold",
  "Discovery call booked",
];

/** Three-pane inbox shown on the features page. */
export function AgentDashboardMockup() {
  return (
    <BrowserMockup address="Cael inbox">
      <div className="grid md:grid-cols-[17rem_1fr] xl:grid-cols-[18rem_1fr_17rem]">
        <div className="border-line bg-mist hidden border-r p-3 md:block">
          <p className="flex items-center justify-between px-3 py-2 font-medium">
            Conversations
            <span className="text-body text-sm">3 open</span>
          </p>
          <ul className="space-y-1.5">
            {threads.map((thread) => (
              <li
                key={thread.name}
                className={cn(
                  "flex gap-3 rounded-2xl p-3",
                  thread.active && "bg-paper shadow-card",
                )}
              >
                <Avatar
                  initials={thread.initials}
                  tone={thread.active ? "slate" : "cyan"}
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{thread.name}</span>
                  <span className="text-body block text-sm leading-snug">
                    {thread.preview}
                  </span>
                  <Badge tone={thread.tone} className="mt-2">
                    {thread.state}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col p-5 sm:p-7">
          <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <span className="flex items-center gap-3">
              <Avatar initials="MC" />
              <span>
                <span className="block leading-tight font-semibold">
                  Maya Chen
                </span>
                <span className="text-body text-sm">Lead score 86</span>
              </span>
            </span>
            <span className="bg-ink text-paper inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
              <Hand className="size-4" />
              Take over
            </span>
          </div>
          <div className="space-y-3 pt-5">
            <p className="text-body flex items-center justify-center gap-2 text-sm">
              <Bot className="size-4" />
              Visitor was told this is an AI agent
            </p>
            <MessageBubble from="visitor">
              Can we roll out to 40 reps this quarter?
            </MessageBubble>
            <MessageBubble from="agent" source="Rollout guide">
              Yes. Teams start with one channel, then add the rest. Is there a
              date you are working toward?
            </MessageBubble>
            <MessageBubble from="visitor">
              Before our March launch. Can someone show us?
            </MessageBubble>
            <MessageBubble from="agent" source="Jonas’s calendar">
              Jonas is free Thursday at 2:00 PM. Shall I book it?
            </MessageBubble>
          </div>
          <div className="border-violet/30 bg-violet-soft mt-5 rounded-2xl border p-4">
            <p className="text-violet-ink text-sm font-semibold">
              Suggested next step
            </p>
            <p className="mt-1 text-[0.9375rem]">
              Send Jonas the briefing and confirm Thursday at 2:00 PM.
            </p>
          </div>
        </div>

        <div className="border-line bg-mist hidden border-l p-5 xl:block">
          <p className="font-medium">Lead context</p>
          <dl className="mt-3 space-y-3">
            {context.map((item) => (
              <div key={item.label}>
                <dt className="text-body text-sm">{item.label}</dt>
                <dd className="font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 font-medium">Activity</p>
          <ul className="mt-2 space-y-2.5">
            {activity.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-[0.9375rem] leading-snug"
              >
                <CircleCheck className="text-mint-ink mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </BrowserMockup>
  );
}
