import Link from "next/link";

import { cn } from "@/lib/cn";

interface LogoMarkProps {
  className?: string;
}

/** Cael mark: an open conversation ring with a signal at its opening. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect width="40" height="40" rx="12" fill="#093efe" />
      <path
        d="M27.4 13.2A10 10 0 1 0 27.4 26.8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  size?: "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="Cael AI Sales Agent, home"
      className={cn(
        "inline-flex min-h-11 items-center gap-2.5 rounded-xl",
        className,
      )}
    >
      <LogoMark className={size === "lg" ? "size-12" : "size-9"} />
      <span
        className={cn(
          "font-display font-semibold tracking-tight whitespace-nowrap",
          size === "lg"
            ? "text-[1.375rem] sm:text-[1.75rem] lg:max-xl:text-[1.375rem]"
            : "text-lg",
        )}
      >
        Cael
        <span className={cn("font-light", size === "md" && "max-xl:hidden")}>
          {" "}
          AI Sales Agent
        </span>
      </span>
    </Link>
  );
}
