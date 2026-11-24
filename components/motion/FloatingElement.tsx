"use client";

import { useRef, type ReactNode } from "react";

import { gsap, MOTION_OK_DESKTOP, useGSAP } from "@/lib/gsap";

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * A short, soft float when the element enters the viewport. It settles in
 * under five seconds, so no pause control is needed (WCAG 2.2.2).
 */
export function FloatingElement({
  children,
  className,
  delay = 0,
}: FloatingElementProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK_DESKTOP, () => {
        gsap.to(ref.current, {
          y: -7,
          duration: 1.1,
          delay,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 3,
          scrollTrigger: {
            trigger: ref.current,
            start: "clamp(top 90%)",
            toggleActions: "restart none restart none",
          },
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
