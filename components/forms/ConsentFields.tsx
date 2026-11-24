import Link from "next/link";

import { marketingConsent } from "@/lib/leads/validation";

/** Optional, unticked marketing consent plus the bot trap. */
export function ConsentFields() {
  return (
    <>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
        <input
          type="checkbox"
          name="marketingConsent"
          className="mt-1 size-5 shrink-0"
        />
        <span className="text-[0.9375rem]">{marketingConsent.text}</span>
      </label>
      <p className="text-body text-[0.9375rem]">
        We use your details to answer this request. Read the{" "}
        <Link
          href="/privacy"
          className="text-ink font-medium underline underline-offset-2"
        >
          privacy page
        </Link>
        .
      </p>
    </>
  );
}
