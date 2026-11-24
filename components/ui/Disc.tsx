import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type DiscSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<DiscSize, string> = {
  sm: "size-11",
  md: "size-14",
  lg: "size-[4.5rem]",
  xl: "size-24",
};

interface DiscProps {
  children: ReactNode;
  size?: DiscSize;
  className?: string;
}

/** Raised round plate used for icons across the site. Always decorative. */
export function Disc({ children, size = "md", className }: DiscProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "disc-surface inline-flex shrink-0 items-center justify-center rounded-full",
        sizes[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
