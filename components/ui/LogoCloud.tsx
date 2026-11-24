"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { IntegrationGlyph } from "@/components/content/IntegrationGlyph";
import type { Integration } from "@/types/content";

import { IconButton } from "./IconButton";

interface LogoCloudProps {
  items: Integration[];
  label: string;
}

/** Scrollable row of neutral wordmarks with previous and next controls. */
export function LogoCloud({ items, label }: LogoCloudProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft >= max - 2,
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  const move = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    track.scrollBy({
      left: direction * track.clientWidth * 0.7,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <div className="flex items-center gap-4 sm:gap-8">
      <IconButton
        label="Show previous tools"
        disabled={edges.start}
        onClick={() => move(-1)}
      >
        <ChevronLeft className="size-5" />
      </IconButton>
      <ul
        ref={trackRef}
        aria-label={label}
        tabIndex={0}
        onScroll={measure}
        className="flex min-w-0 flex-1 snap-x items-center gap-10 overflow-x-auto overscroll-x-contain rounded-xl py-3 pr-12 [mask-image:linear-gradient(90deg,#000_90%,transparent)] [scrollbar-width:none] sm:gap-14 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <li
            key={item.name}
            className="flex shrink-0 snap-start items-center gap-3 text-[#5d6570]"
          >
            <IntegrationGlyph category={item.category} className="size-7" />
            <span className="font-display text-[1.375rem] font-bold tracking-tight whitespace-nowrap">
              {item.name}
            </span>
          </li>
        ))}
      </ul>
      <IconButton
        label="Show more tools"
        disabled={edges.end}
        onClick={() => move(1)}
      >
        <ChevronRight className="size-5" />
      </IconButton>
    </div>
  );
}
