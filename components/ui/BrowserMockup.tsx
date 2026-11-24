import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface BrowserMockupProps {
  children: ReactNode;
  address: string;
  className?: string;
}

/** App window frame for product interface mockups. */
export function BrowserMockup({
  children,
  address,
  className,
}: BrowserMockupProps) {
  return (
    <div
      className={cn(
        "border-edge bg-paper shadow-float overflow-hidden rounded-[1.5rem] border",
        className,
      )}
    >
      <div className="border-line bg-mist grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b px-4 py-3">
        <span className="flex gap-1.5">
          <span className="bg-edge size-2.5 rounded-full" />
          <span className="bg-edge size-2.5 rounded-full" />
          <span className="bg-edge size-2.5 rounded-full" />
        </span>
        <span className="border-line bg-paper text-body inline-flex items-center gap-1.5 rounded-full border px-4 py-1 text-sm">
          <Lock className="size-3.5" />
          {address}
        </span>
        <span />
      </div>
      {children}
    </div>
  );
}
