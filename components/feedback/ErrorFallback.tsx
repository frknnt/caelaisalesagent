"use client";

import { useEffect, useRef } from "react";

import { Button, ButtonLink } from "@/components/ui/Button";

interface ErrorFallbackProps {
  error: unknown;
  retry: () => void;
  title: string;
  description: string;
}

/** Server errors carry a digest that matches the `request.error` log line. */
function digestOf(error: unknown) {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? error.digest
      : undefined;
  return typeof digest === "string" ? digest : null;
}

/** Shown by an error boundary. Never prints the error message itself. */
export function ErrorFallback({
  error,
  retry,
  title,
  description,
}: ErrorFallbackProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const digest = digestOf(error);

  useEffect(() => headingRef.current?.focus(), [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-2xl px-[1.125rem] py-20 text-center sm:py-32"
    >
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="display-lg font-normal outline-none"
      >
        {title}
      </h1>
      <p className="text-body mt-4 text-[1.0625rem]">{description}</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button size="lg" onClick={retry}>
          Try Again
        </Button>
        <ButtonLink href="/support" variant="quiet">
          Visit Support
        </ButtonLink>
      </div>
      {digest ? (
        <p className="text-body mt-6 text-[0.9375rem]">
          Error reference: {digest}
        </p>
      ) : null}
    </div>
  );
}
