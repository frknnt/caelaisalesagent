import { CalendarClock, CircleCheck, UserCheck } from "lucide-react";

import { Avatar } from "./Avatar";

export function MeetingCard() {
  return (
    <div className="border-line shadow-float rounded-[1.75rem] border bg-[#f4f5f8] p-2">
      <div className="flex items-start gap-3.5 px-3 pt-3 pb-4">
        <Avatar initials="JO" tone="amber" className="size-14 text-base" />
        <div className="min-w-0 flex-1">
          <p className="leading-tight font-semibold">Call booked</p>
          <p className="text-body text-sm">With Jonas Okoye</p>
          <p className="text-cyan-ink mt-1 text-sm font-medium">
            View briefing
          </p>
        </div>
        <span className="bg-violet mt-6 hidden items-center xl:inline-flex gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white">
          <UserCheck className="size-4" />
          Assigned
        </span>
      </div>
      <div className="bg-paper flex items-center justify-between gap-3 rounded-[1.35rem] px-4 py-3.5 text-sm">
        <span className="flex items-center gap-2">
          <CalendarClock className="size-5" strokeWidth={1.8} />
          <span className="font-semibold">Thu, 2:00 PM</span>
        </span>
        <span className="text-mint-ink flex items-center gap-1.5 font-medium">
          <CircleCheck className="size-4" />
          CRM updated
        </span>
      </div>
    </div>
  );
}
