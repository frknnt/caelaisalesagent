export const contactTopics = [
  { id: "demo", label: "Book a demo" },
  { id: "sales", label: "Pricing and plans" },
  { id: "integration", label: "Integrations" },
  { id: "security", label: "Security" },
  { id: "support", label: "Support" },
  { id: "careers", label: "Careers" },
  { id: "general", label: "Something else" },
] as const;

export type ContactTopic = (typeof contactTopics)[number]["id"];

export const trialChannels = [
  { id: "web", label: "Website chat" },
  { id: "messaging", label: "Messaging" },
  { id: "email", label: "Email" },
] as const;

export type TrialChannel = (typeof trialChannels)[number]["id"];

/** Change the version whenever the consent wording changes. */
export const marketingConsent = {
  purpose: "product_updates",
  version: "2026-11-24.1",
  text: "Send me occasional product updates by email. I can opt out at any time.",
} as const;

export type LeadField = "name" | "email" | "company" | "topic" | "message";

export type LeadFieldErrors = Partial<Record<LeadField, string>>;

export interface LeadRequest {
  kind: "trial" | "contact";
  name: string;
  email: string;
  company: string;
  topic: ContactTopic | null;
  message: string;
  agentMode: string;
  channel: TrialChannel | null;
  marketingConsent: boolean;
}

export type LeadValidation =
  | { ok: true; value: LeadRequest }
  | { ok: false; fieldErrors: LeadFieldErrors };

type LeadInput = Pick<FormData, "get">;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(input: LeadInput, key: string, max: number) {
  const value = input.get(key);
  return typeof value === "string" ? value.trim().slice(0, max + 1) : "";
}

export function isContactTopic(value: unknown): value is ContactTopic {
  return contactTopics.some((topic) => topic.id === value);
}

function isTrialChannel(value: unknown): value is TrialChannel {
  return trialChannels.some((channel) => channel.id === value);
}

export function validateLead(
  input: LeadInput,
  agentModeIds: readonly string[],
): LeadValidation {
  const kind = input.get("kind") === "trial" ? "trial" : "contact";
  const name = text(input, "name", 120);
  const email = text(input, "email", 254).toLowerCase();
  const company = text(input, "company", 160);
  const message = text(input, "message", 4000);
  const topic = input.get("topic");
  const agentMode = text(input, "agentMode", 60);
  const channel = input.get("channel");
  const fieldErrors: LeadFieldErrors = {};

  if (!name) fieldErrors.name = "Enter your name.";
  else if (name.length > 120)
    fieldErrors.name = "Use 120 characters or fewer for your name.";

  if (!email) fieldErrors.email = "Enter your work email.";
  else if (email.length > 254 || !EMAIL.test(email))
    fieldErrors.email = "Enter an email address like name@company.com.";

  if (kind === "trial" && !company)
    fieldErrors.company = "Enter your company name.";
  else if (company.length > 160)
    fieldErrors.company = "Use 160 characters or fewer for your company.";

  if (kind === "contact" && !isContactTopic(topic))
    fieldErrors.topic = "Choose what you would like to talk about.";

  if (kind === "contact" && topic !== "demo" && !message)
    fieldErrors.message = "Write a short message so we can help.";
  else if (message.length > 4000)
    fieldErrors.message = "Use 4,000 characters or fewer for your message.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      kind,
      name,
      email,
      company,
      topic: kind === "contact" && isContactTopic(topic) ? topic : null,
      message,
      agentMode: agentModeIds.includes(agentMode) ? agentMode : "",
      channel: kind === "trial" && isTrialChannel(channel) ? channel : null,
      marketingConsent: input.get("marketingConsent") === "on",
    },
  };
}

export function buildLeadPayload(
  lead: LeadRequest,
  context: { source: string; submittedAt: string },
) {
  return {
    ...lead,
    source: context.source,
    submittedAt: context.submittedAt,
    // Consent is recorded either way, so "not granted" is explicit.
    marketingConsent: {
      granted: lead.marketingConsent,
      purpose: marketingConsent.purpose,
      textVersion: marketingConsent.version,
      timestamp: context.submittedAt,
      source: context.source,
    },
  };
}
