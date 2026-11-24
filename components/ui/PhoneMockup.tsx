import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PhoneMockupProps {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
}

/** Device frame cropped at the bottom, so it can sit flush on a panel edge. */
export function PhoneMockup({
  children,
  className,
  screenClassName,
}: PhoneMockupProps) {
  return (
    <div
      className={cn(
        "bg-ink w-full overflow-hidden rounded-t-[3.5rem] px-2 pt-2 sm:rounded-t-[4rem] sm:px-2.5 sm:pt-2.5",
        className,
      )}
    >
      <div
        className={cn(
          "bg-paper relative h-full overflow-hidden rounded-t-[3rem] sm:rounded-t-[3.4rem]",
          screenClassName,
        )}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-6 pt-4 sm:px-8 lg:max-xl:px-6">
          <span className="text-[0.9375rem] font-semibold tabular-nums">
            9:41
          </span>
          <span className="bg-ink h-8 w-24 rounded-full sm:h-9 sm:w-28" />
          <span className="flex items-center justify-end gap-1.5">
            <Signal className="size-4" strokeWidth={2.4} />
            <Wifi className="size-4" strokeWidth={2.4} />
            <BatteryFull className="size-5" strokeWidth={2} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
