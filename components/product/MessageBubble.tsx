import { FileText } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface MessageBubbleProps {
  from: "visitor" | "agent" | "rep";
  children: ReactNode;
  source?: string;
  className?: string;
}

/** One conversation turn. Agent answers can carry the approved source used. */
export function MessageBubble({
  from,
  children,
  source,
  className,
}: MessageBubbleProps) {
  const isVisitor = from === "visitor";
  return (
    <div className={cn("flex", isVisitor && "justify-end", className)}>
      <div
        className={cn(
          "max-w-[88%] rounded-[1.25rem] px-4 py-2.5 text-[0.9375rem] leading-snug",
          isVisitor && "bg-ink text-paper rounded-br-md",
          from === "agent" && "bg-fog text-ink rounded-bl-md",
          from === "rep" && "bg-amber-soft text-ink rounded-bl-md",
        )}
      >
        {children}
        {source ? (
          <span className="bg-paper text-cyan-ink mt-2 flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium">
            <FileText className="size-3.5" />
            {source}
          </span>
        ) : null}
      </div>
    </div>
  );
}
