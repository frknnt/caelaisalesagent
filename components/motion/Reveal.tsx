"use client";

import { useRef, type ReactNode } from "react";

import { gsap, isBelowFold, MOTION_OK, useGSAP } from "@/lib/gsap";

interface RevealProps {
  children: ReactNode;
  className?: string;
  y?: number;
}

/** Content is visible in the HTML; only below-the-fold blocks are revealed. */
export function Reveal({ children, className, y = 20 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const element = ref.current;
        if (!element || !isBelowFold(element)) return;
        gsap.from(element, {
          opacity: 0,
          y,
          duration: 0.5,
          ease: "power2.out",
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
