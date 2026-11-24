"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/cn";
import type { FaqItem } from "@/types/content";

interface AccordionProps {
  items: FaqItem[];
  /** Item open on first render. */
  defaultOpen?: string;
  headingLevel?: 2 | 3;
}

export function Accordion({
  items,
  defaultOpen,
  headingLevel = 3,
}: AccordionProps) {
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null);
  const baseId = useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const isOpen = open === item.id;
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;
        return (
          <div
            key={item.id}
            className="border-line bg-paper relative rounded-[1.75rem] border p-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "bg-amber absolute top-7 -left-1.5 h-8 w-1.5 rounded-l-full transition-opacity duration-200",
                isOpen ? "opacity-100" : "opacity-0",
              )}
            />
            <Heading className="m-0 text-[1.0625rem] tracking-normal">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : item.id)}
                className={cn(
                  "group flex min-h-[4.5rem] w-full items-center justify-between gap-4 rounded-[1.375rem] py-2 pr-2 pl-5 text-left font-sans leading-snug font-medium transition-colors duration-200",
                  isOpen
                    ? "from-amber-soft via-fog to-fog bg-linear-to-r via-30%"
                    : "bg-fog hover:bg-haze",
                )}
              >
                <span className="text-pretty">{item.question}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-14 shrink-0 items-center justify-center rounded-2xl transition-colors duration-200",
                    isOpen ? "bg-ink text-paper" : "bg-paper text-ink",
                  )}
                >
                  {isOpen ? (
                    <Minus className="size-5" />
                  ) : (
                    <Plus className="size-5" />
                  )}
                </span>
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
            >
              <p className="text-body max-w-[42rem] px-5 pt-5 pb-5">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
