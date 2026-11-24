"use client";

import { useRef, type ReactNode } from "react";

import { gsap, isBelowFold, MOTION_OK, useGSAP } from "@/lib/gsap";

interface StaggerGridProps {
  children: ReactNode;
  className?: string;
}

/** Staggers direct children as the group enters the viewport. */
export function StaggerGrid({ children, className }: StaggerGridProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const element = ref.current;
        if (!element || !isBelowFold(element)) return;
        const items = Array.from(element.children);
        gsap.from(items, {
          opacity: 0,
          y: 18,
          duration: 0.5,
          ease: "power2.out",
          // Capped so the last card never feels late.
          stagger: Math.min(0.07, 0.42 / Math.max(items.length, 1)),
          clearProps: "opacity,transform",
          scrollTrigger: { trigger: element, start: "top 85%", once: true },
        });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
