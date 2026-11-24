"use client";

import { ErrorFallback } from "@/components/feedback/ErrorFallback";

interface ErrorPageProps {
  error: unknown;
  retry: () => void;
}

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  return (
    <ErrorFallback
      error={error}
      retry={retry}
      title="Something went wrong"
      description="The page could not be loaded. Try again, or visit support if it keeps happening."
    />
  );
}
