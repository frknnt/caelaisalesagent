import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "cyan" | "violet" | "mint" | "amber" | "neutral";

const tones: Record<Tone, string> = {
  cyan: "bg-cyan-soft text-cyan-ink",
  violet: "bg-violet-soft text-violet-ink",
  mint: "bg-mint-soft text-mint-ink",
  amber: "bg-amber-soft text-amber-ink",
  neutral: "bg-fog text-[#3b404a]",
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm leading-5 font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
