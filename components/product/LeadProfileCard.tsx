import {
  ChevronRight,
  ListChecks,
  MessageCircle,
  Target,
  UserRound,
} from "lucide-react";

import { Avatar } from "./Avatar";

const tabs = [
  { icon: UserRound, label: "Profile", active: true },
  { icon: Target, label: "Signals", active: false },
  { icon: MessageCircle, label: "Chat", active: false },
  { icon: ListChecks, label: "Tasks", active: false },
];

export function LeadProfileCard() {
  return (
    <div className="border-line shadow-float rounded-[1.75rem] border bg-[#f1f3f6] p-2">
      <div className="flex items-center gap-3 px-3 pt-2.5 pb-3.5">
        <Avatar initials="MC" className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="leading-tight font-semibold">Maya Chen</p>
          <p className="text-body text-sm">Head of Sales</p>
        </div>
        <span className="bg-violet rounded-full px-2.5 py-1 text-sm font-medium text-white">
          High intent
        </span>
        <span className="bg-ink text-paper hidden size-6 items-center justify-center rounded-full xl:inline-flex">
          <ChevronRight className="size-4" />
        </span>
      </div>
      <div className="bg-paper grid grid-cols-4 rounded-[1.35rem] px-2 py-3.5">
        {tabs.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={
              active
                ? "flex flex-col items-center gap-1 text-sm font-semibold"
                : "text-body flex flex-col items-center gap-1 text-sm"
            }
          >
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.7} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
