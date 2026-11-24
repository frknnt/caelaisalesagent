import {
  ArrowRight,
  Bot,
  CalendarCheck,
  CircleCheck,
  Clock,
  Database,
  Globe,
  Headset,
  History,
  Mail,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Disc } from "@/components/ui/Disc";

import { Avatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";

/** Website chat widget. */
export function WebChatScreen() {
  return (
    <div className="px-5 pt-5 pb-8 sm:px-6">
      <div className="flex items-center justify-between">
        <span className="bg-cyan-ink inline-flex size-11 items-center justify-center rounded-full text-white">
          <Globe className="size-5" />
        </span>
        <span className="bg-paper text-cyan-ink rounded-full px-4 py-2 text-sm font-semibold">
          Website
        </span>
      </div>
      <div className="mt-5 text-center">
        <p className="font-display text-2xl font-semibold">Hi, I’m Cael</p>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-[#2f4a52]">
          <Bot className="size-4" />
          An AI agent for Orrin Labs
        </p>
      </div>
      <div className="mt-5 space-y-3">
        <MessageBubble from="visitor">Do you work with agencies?</MessageBubble>
        <div className="bg-paper rounded-[1.25rem] rounded-bl-md px-4 py-3 text-[0.9375rem] leading-snug">
          Yes. Each client gets a separate workspace.
        </div>
        <span className="border-cyan-ink/30 text-cyan-ink flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-[0.9375rem] font-semibold">
          <Headset className="size-4" />
          Talk to a person
        </span>
        <div className="bg-paper text-body flex items-center justify-between rounded-full py-1.5 pr-1.5 pl-4 text-[0.9375rem]">
          Ask a question
          <span className="bg-cyan-ink inline-flex size-9 items-center justify-center rounded-full text-white">
            <Send className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

const timeline = [
  { icon: Globe, label: "Website chat", detail: "Asked about pricing" },
  { icon: Mail, label: "Email follow-up", detail: "Opened the rollout guide" },
  { icon: CalendarCheck, label: "Calendar", detail: "Picked Thu, 2:00 PM" },
];

/** One lead across several channels. */
export function UnifiedLeadScreen() {
  return (
    <div className="px-5 pt-6 pb-8 sm:px-7">
      <div className="border-line flex items-center justify-between border-b pb-4">
        <span className="flex items-center gap-3">
          <Avatar initials="MC" />
          <span className="leading-tight">
            <span className="block font-semibold">Maya Chen</span>
            <span className="text-body text-sm">3 channels, 1 thread</span>
          </span>
        </span>
        <Badge tone="violet">86</Badge>
      </div>
      <ol className="before:bg-line relative mt-5 space-y-5 before:absolute before:top-5 before:bottom-5 before:left-[1.3rem] before:w-0.5">
        {timeline.map(({ icon: Icon, label, detail }) => (
          <li key={label} className="relative flex items-center gap-4">
            <Disc size="sm">
              <Icon className="size-5" strokeWidth={1.9} />
            </Disc>
            <span className="leading-snug">
              <span className="block font-semibold">{label}</span>
              <span className="text-body block text-sm">{detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-[1.4rem] bg-[#eceaf8] p-1.5">
        <p className="text-violet-ink px-3 py-1.5 text-sm font-semibold">
          Next best action
        </p>
        <div className="bg-paper rounded-[1.1rem] p-4">
          <p className="font-semibold">Send Jonas the briefing</p>
          <p className="text-body mt-0.5 text-sm">
            Summary and source links attached
          </p>
          <span className="bg-ink text-paper mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            Review and send
            <ArrowRight className="size-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

const records = [
  { icon: Database, label: "Deal stage", value: "Qualified" },
  { icon: Clock, label: "Follow-up", value: "Monday" },
  { icon: History, label: "Last activity", value: "Today" },
];

/** Email follow-up plus the CRM record it updates. */
export function EmailScreen() {
  return (
    <div className="px-5 pt-5 pb-8 sm:px-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-[#6d7391] text-white">
          <Mail className="size-5" />
        </span>
        <span className="text-mint-ink bg-mint-soft inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold">
          <CircleCheck className="size-4" />
          Synced
        </span>
      </div>
      <div className="border-line bg-paper shadow-card mt-5 rounded-[1.4rem] border p-4">
        <p className="text-body text-sm">To Leo Brandt</p>
        <p className="mt-1 leading-snug font-semibold">
          The sync question you asked
        </p>
        <p className="text-body mt-2 text-[0.9375rem] leading-snug">
          Here is the field list you asked for. Want to see it with your data?
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {records.map(({ icon: Icon, label, value }) => (
          <li key={label} className="flex items-center gap-3">
            <Disc size="sm">
              <Icon className="size-5" strokeWidth={1.9} />
            </Disc>
            <span className="text-body flex-1 text-[0.9375rem]">{label}</span>
            <span className="font-semibold">{value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Lead scoring screen used in the two-column launch section. */
export function NextActionScreen() {
  return (
    <div className="px-5 pt-7 pb-[4.5rem] sm:px-8">
      <div className="flex items-center justify-between">
        <Avatar initials="MC" />
        <span className="bg-cyan text-ink rounded-full px-4 py-2 text-[0.9375rem] font-semibold">
          Ready for a rep
        </span>
      </div>
      <p className="font-display mt-7 text-[1.75rem] leading-tight sm:text-[2rem]">
        Maya is ready to talk to your team
      </p>
      <p className="text-body mt-2">
        She named a date, a team size, and a decision maker.
      </p>
      <div className="mt-6 rounded-[1.6rem] bg-[#e4e6ee] p-1.5">
        <div className="bg-paper rounded-[1.3rem] p-4">
          <div className="flex items-center gap-3">
            <Avatar initials="JO" tone="amber" />
            <span className="flex-1 leading-tight">
              <span className="block font-semibold">Jonas Okoye</span>
              <span className="text-body text-sm">Enterprise team</span>
            </span>
            <span className="bg-ink text-paper inline-flex size-7 items-center justify-center rounded-full">
              <CircleCheck className="size-4" />
            </span>
          </div>
          <div className="border-line mt-4 flex items-center justify-between border-t pt-3.5 text-[0.9375rem]">
            <span className="text-body">
              <b className="text-ink font-semibold">Thu, 2:00 PM</b>
            </span>
            <span className="font-semibold">Score 86</span>
          </div>
        </div>
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-[0.9375rem] font-medium">
        <Bot className="text-mint-ink size-5" />
        Agent goes silent on takeover
      </p>
    </div>
  );
}
