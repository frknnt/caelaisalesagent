"use client";

import { ArrowRight, Check, UserCheck } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { agentModes } from "@/data/home-content";
import { cn } from "@/lib/cn";

/** Accessible tabs: arrow keys, Home and End move between agent modes. */
export function AgentModeTabs() {
  const [activeId, setActiveId] = useState("meeting-booker");
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const baseId = useId();
  const activeIndex = agentModes.findIndex((mode) => mode.id === activeId);

  const focusMode = (index: number) => {
    const wrapped = (index + agentModes.length) % agentModes.length;
    const mode = agentModes[wrapped];
    if (!mode) return;
    setActiveId(mode.id);
    tabRefs.current.get(mode.id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: activeIndex + 1,
      ArrowDown: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      ArrowUp: activeIndex - 1,
      Home: 0,
      End: agentModes.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focusMode(next);
  };

  return (
    <div className="border-line rounded-panel border bg-[#f7f8fa] p-2 sm:p-4">
      <div
        role="tablist"
        aria-label="Agent modes"
        onKeyDown={onKeyDown}
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
      >
        {agentModes.map((mode, index) => {
          const selected = mode.id === activeId;
          return (
            <button
              key={mode.id}
              ref={(node) => {
                if (node) tabRefs.current.set(mode.id, node);
                else tabRefs.current.delete(mode.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-${mode.id}-tab`}
              aria-selected={selected}
              aria-controls={`${baseId}-${mode.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(mode.id)}
              className={cn(
                "group flex flex-col rounded-[1.75rem] p-2 text-center transition-colors duration-200 max-lg:flex-row max-lg:items-center max-lg:gap-4 max-lg:rounded-[1.4rem] max-lg:text-left",
                index === agentModes.length - 1 &&
                  "sm:max-lg:col-span-2 sm:max-lg:justify-center",
                selected
                  ? "bg-[linear-gradient(180deg,transparent_48%,#e6e8ed_92%),linear-gradient(95deg,#fba00b_0%,#ffd79a_20%,#5bcde4_44%,#8a7cf5_92%)]"
                  : "bg-linear-to-b from-[#e6e8ec] to-[#dcdfe5] hover:from-[#e0e3e8] hover:to-[#d3d7de]",
              )}
            >
              <span
                className={cn(
                  "font-display flex min-h-12 items-center justify-center rounded-[1.1rem] px-3 text-lg leading-tight font-medium shadow-[0_10px_16px_-10px_rgb(20_28_45/0.4)] lg:min-h-[5.25rem] lg:rounded-[1.35rem] lg:text-xl",
                  selected ? "bg-paper" : "bg-[#f1f3f5]",
                )}
              >
                {mode.name}
              </span>
              <span
                className={cn(
                  "px-2 text-[0.9375rem] lg:pt-4 lg:pb-3.5",
                  selected ? "text-ink font-semibold" : "text-[#474d57]",
                )}
              >
                {mode.tagline}
              </span>
            </button>
          );
        })}
      </div>

      {agentModes.map((mode) => (
        <div
          key={mode.id}
          role="tabpanel"
          id={`${baseId}-${mode.id}-panel`}
          aria-labelledby={`${baseId}-${mode.id}-tab`}
          hidden={mode.id !== activeId}
          tabIndex={0}
          className="bg-paper border-line mt-2 rounded-[1.75rem] border sm:mt-3"
        >
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.1fr_1fr_0.9fr] lg:gap-12">
            <div>
              <p className="font-display text-2xl font-medium">{mode.name}</p>
              <p className="text-body mt-2">{mode.summary}</p>
            </div>
            <div>
              <p className="font-semibold">What it handles</p>
              <ul className="mt-3 space-y-2.5">
                {mode.handles.map((item) => (
                  <li key={item} className="flex gap-2.5 leading-snug">
                    <Check
                      aria-hidden="true"
                      className="text-mint-ink mt-0.5 size-5 shrink-0"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-soft rounded-[1.4rem] p-5">
              <p className="text-amber-ink flex items-center gap-2 font-semibold">
                <UserCheck className="size-5" aria-hidden="true" />
                Hands over
              </p>
              <p className="mt-2 leading-snug">{mode.handsOver}</p>
              <p className="text-amber-ink mt-4 flex items-center gap-1.5 text-[0.9375rem] font-medium">
                To a person, with full context
                <ArrowRight className="size-4" aria-hidden="true" />
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
