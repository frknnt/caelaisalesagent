import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Card } from "./Card";

interface FeatureCardProps {
  title: string;
  description: string;
  visual: ReactNode;
  /** Where the copy sits relative to the visual. */
  copy?: "top" | "bottom";
  className?: string;
}

/** Bento card: short copy plus a real product visual. */
export function FeatureCard({
  title,
  description,
  visual,
  copy = "top",
  className,
}: FeatureCardProps) {
  return (
    <Card
      as="article"
      className={cn(
        "flex min-h-[25rem] flex-col sm:min-h-[27rem]",
        copy === "bottom" && "justify-end",
        className,
      )}
    >
      <div
        className={cn(
          "relative z-10 px-7 sm:px-10",
          copy === "top" ? "order-1 pt-9" : "order-2 pb-9",
        )}
      >
        <h3 className="text-[1.375rem] leading-tight font-medium sm:text-2xl">
          {title}
        </h3>
        <p className="text-body mt-3 max-w-[19rem]">{description}</p>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "relative flex-1",
          copy === "top" ? "order-2" : "order-1",
        )}
      >
        {visual}
      </div>
    </Card>
  );
}
