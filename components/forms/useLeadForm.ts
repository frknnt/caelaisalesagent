"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  type FormEvent,
} from "react";

import { submitLead, type LeadFormState } from "@/lib/leads/submit";

const initialState: LeadFormState = { status: "idle", fieldErrors: {} };

/** Shared submit behavior: keeps typed values and moves focus to the result. */
export function useLeadForm() {
  const [state, action, pending] = useActionState(submitLead, initialState);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "idle") statusRef.current?.focus();
  }, [state]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return { state, action, pending, onSubmit, statusRef };
}
