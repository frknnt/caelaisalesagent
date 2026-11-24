"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

if (typeof document !== "undefined") {
  // Trigger positions depend on final line wrapping, so recalculate once.
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const MOTION_OK_DESKTOP =
  "(prefers-reduced-motion: no-preference) and (min-width: 1024px)";

/** True when an element is still below the fold, so hiding it cannot flash. */
export function isBelowFold(element: Element) {
  return element.getBoundingClientRect().top > window.innerHeight * 0.92;
}

export { gsap, ScrollTrigger, useGSAP };
