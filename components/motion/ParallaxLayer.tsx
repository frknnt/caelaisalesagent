"use client";

import { useRef, type ReactNode } from "react";

import { gsap, MOTION_OK_DESKTOP, useGSAP } from "@/lib/gsap";

interface ParallaxLayerProps {
  children: ReactNode;
  className?: string;
  /** Vertical travel in px while the layer crosses the viewport. */
  distance?: number;
  /** Degrees of rotation to add by the end of the travel. */
  rotate?: number;
}

/** Scroll-linked drift. Desktop only, and off under reduced motion. */
export function ParallaxLayer({
  children,
  className,
  distance = -40,
  rotate = 0,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK_DESKTOP, () => {
        gsap.to(ref.current, {
          y: distance,
          rotation: rotate,
          ease: "none",
          scrollTrigger: {
            trigger: ref.current,
            start: "clamp(top 80%)",
            end: "bottom top",
            scrub: 0.6,
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
