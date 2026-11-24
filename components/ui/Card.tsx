import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CornerDots } from "./CornerDots";

interface CardProps {
  children: ReactNode;
  className?: string;
  dots?: boolean;
  as?: "div" | "article" | "li";
}

export function Card({
  children,
  className,
  dots = true,
  as: Tag = "div",
}: CardProps) {
  return (
    <Tag
      className={cn(
        "card-lift rounded-card border-line bg-paper relative isolate overflow-hidden border",
        className,
      )}
    >
      {dots ? <CornerDots /> : null}
      {children}
    </Tag>
  );
}
