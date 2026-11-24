import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";

import type { LeadFormState } from "@/lib/leads/submit";

interface FormStatusProps {
  state: LeadFormState;
  ref: Ref<HTMLDivElement>;
  successTitle: string;
  successText: string;
}

/** Result message. Focused after submit so it is announced once. */
export function FormStatus({
  state,
  ref,
  successTitle,
  successText,
}: FormStatusProps) {
  if (state.status === "idle") return null;

  const errors = Object.entries(state.fieldErrors);
  const isSuccess = state.status === "sent";

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={isSuccess ? "status" : "alert"}
      className={
        isSuccess
          ? "bg-mint-soft rounded-2xl p-5"
          : "bg-rose-soft rounded-2xl p-5"
      }
    >
      <div className="flex gap-3">
        {isSuccess ? (
          <CircleCheck
            className="text-mint-ink mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <TriangleAlert
            className="text-rose-ink mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
        )}
        <div>
          {isSuccess ? (
            <>
              <p className="font-semibold">{successTitle}</p>
              <p className="mt-1">{successText}</p>
            </>
          ) : null}
          {state.status === "invalid" ? (
            <>
              <p className="font-semibold">Check these fields</p>
              <ul className="mt-1 list-disc pl-5">
                {errors.map(([field, message]) => (
                  <li key={field}>
                    <a
                      href={`#${field}`}
                      className="inline-flex min-h-6 items-center underline underline-offset-2"
                    >
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {state.status === "unavailable" ? (
            <>
              <p className="font-semibold">This form is not connected yet</p>
              <p className="mt-1">
                Nothing was sent or stored. Your answers are still in the form.
                Please try again later.
              </p>
            </>
          ) : null}
          {state.status === "failed" ? (
            <>
              <p className="font-semibold">Your request was not delivered</p>
              <p className="mt-1">
                Your answers are still in the form, so you can send them again.
                If it keeps happening, see{" "}
                <Link href="/support" className="underline underline-offset-2">
                  Support
                </Link>
                .
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
