"use client";

import { ErrorFallback } from "@/components/feedback/ErrorFallback";

interface WorkspaceErrorProps {
  error: unknown;
  retry: () => void;
}

export default function WorkspaceError({ error, retry }: WorkspaceErrorProps) {
  return (
    <ErrorFallback
      error={error}
      retry={retry}
      title="Your workspace could not be loaded"
      description="Try again, or visit support if it keeps happening."
    />
  );
}
