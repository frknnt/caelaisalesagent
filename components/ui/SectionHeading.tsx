import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

import { Disc } from "./Disc";

interface SectionHeadingProps {
  /** Heading text, split around the inline icon when one is given. */
  before: string;
  icon?: LucideIcon;
  after?: string;
  eyebrow?: string;
  description?: string;
  align?: "center" | "left";
  level?: 1 | 2;
  id?: string;
  className?: string;
  wide?: boolean;
}

export function SectionHeading({
  before,
  icon: Icon,
  after,
  eyebrow,
  description,
  align = "center",
  level = 2,
  id,
  className,
  wide = false,
}: SectionHeadingProps) {
  const Heading = level === 1 ? "h1" : "h2";
  const centered = align === "center";

  return (
    <div
      className={cn(
        centered && "mx-auto text-center",
        level === 1 ? "max-w-[68rem]" : wide ? "max-w-5xl" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow ? <p className="text-cyan-ink font-medium">{eyebrow}</p> : null}
      <Heading
        id={id}
        className={cn(
          "font-normal",
          level === 1 ? "display-lg" : "display-md",
          eyebrow && "mt-3",
        )}
      >
        {before}
        {Icon ? (
          <>
            {" "}
            <Disc
              size="sm"
              className="relative -top-[0.06em] mx-0.5 align-middle max-sm:hidden sm:size-[3.25rem]"
            >
              <Icon className="size-[1.375rem]" strokeWidth={1.9} />
            </Disc>{" "}
          </>
        ) : null}
        {after}
      </Heading>
      {description ? (
        <p
          className={cn(
            "text-body mt-4 text-[1.0625rem] text-balance",
            centered && "mx-auto",
            "max-w-[44rem]",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
