"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 10_000;

export function InboxLiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      const active = document.activeElement;
      const isEditing =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement;

      if (document.visibilityState === "visible" && !isEditing) {
        router.refresh();
      }
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <p className="mt-2 text-xs text-body" role="status">
      <span className="mr-1 inline-block size-2 rounded-full bg-mint" />
      Live updates on · refreshes every 10 seconds
    </p>
  );
}
