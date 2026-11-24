"use server";

import { agentModes } from "@/data/home-content";
import { readLeadIntakeUrl } from "@/lib/env";

import {
  buildLeadPayload,
  validateLead,
  type LeadFieldErrors,
} from "./validation";

export interface LeadFormState {
  status: "idle" | "invalid" | "sent" | "unavailable" | "failed";
  fieldErrors: LeadFieldErrors;
}

const DELIVERY_TIMEOUT_MS = 8000;

export async function submitLead(
  _previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  // Bots fill the hidden field. Report success and deliver nothing.
  if (formData.get("website")) return { status: "sent", fieldErrors: {} };

  const result = validateLead(
    formData,
    agentModes.map((mode) => mode.id),
  );
  if (!result.ok) return { status: "invalid", fieldErrors: result.fieldErrors };

  const endpoint = readLeadIntakeUrl(process.env);
  if (!endpoint) return { status: "unavailable", fieldErrors: {} };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildLeadPayload(result.value, {
          source: result.value.kind === "trial" ? "/start-free" : "/contact",
          submittedAt: new Date().toISOString(),
        }),
      ),
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      cache: "no-store",
    });
    return { status: response.ok ? "sent" : "failed", fieldErrors: {} };
  } catch {
    // Never log the payload: it contains personal data.
    return { status: "failed", fieldErrors: {} };
  }
}
