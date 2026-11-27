"use client";

import { useEffect } from "react";

import { PageContainer } from "@/components/layout/PageContainer";

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("inbox.render_failed", error.digest ?? "unknown");
  }, [error]);
  return (
    <PageContainer width="text" className="pt-12 pb-16">
      <div role="alert" className="border border-rose-ink bg-rose-soft p-6">
        <h1 className="text-2xl font-medium">Inbox could not be loaded</h1>
        <p className="mt-2 text-body">
          Your data was not changed. Check your connection and try again.
        </p>
        <button
          className="focus-ring mt-5 min-h-11 border border-ink bg-ink px-5 text-white"
          type="button"
          onClick={reset}
        >
          Try again
        </button>
      </div>
    </PageContainer>
  );
}
