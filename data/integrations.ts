import type {
  Integration,
  IntegrationCategory,
  IntegrationStatus,
} from "@/types/content";

/**
 * Status reflects the product roadmap. Change a status here only when the
 * connection actually ships.
 */
export const integrations: Integration[] = [
  {
    name: "HubSpot",
    category: "CRM",
    status: "Planned",
    description: "Contacts, deals, and conversation summaries.",
  },
  {
    name: "Salesforce",
    category: "CRM",
    status: "Planned",
    description: "Leads, opportunities, and owner assignment.",
  },
  {
    name: "Pipedrive",
    category: "CRM",
    status: "Planned",
    description: "People, deals, and pipeline stage updates.",
  },
  {
    name: "Slack",
    category: "Messaging",
    status: "Considering",
    description: "Handoff alerts in the channel your reps watch.",
  },
  {
    name: "Gmail",
    category: "Email",
    status: "Considering",
    description: "Follow-ups and replies from a shared address.",
  },
  {
    name: "Outlook",
    category: "Email",
    status: "Considering",
    description: "Follow-ups and replies from a work mailbox.",
  },
  {
    name: "WhatsApp",
    category: "Messaging",
    status: "Planned",
    description: "Two-way conversations with the same lead context.",
  },
  {
    name: "Instagram",
    category: "Messaging",
    status: "Planned",
    description: "Direct messages routed into one inbox.",
  },
  {
    name: "LinkedIn",
    category: "Messaging",
    status: "Considering",
    description: "Lead form responses as new conversations.",
  },
  {
    name: "Shopify",
    category: "Commerce",
    status: "Considering",
    description: "Catalog and order answers from store data.",
  },
  {
    name: "Stripe",
    category: "Commerce",
    status: "Considering",
    description: "Plan and payment state read from the source.",
  },
  {
    name: "Calendly",
    category: "Calendar",
    status: "Planned",
    description: "Booking links and confirmed meeting events.",
  },
  {
    name: "Google Calendar",
    category: "Calendar",
    status: "Planned",
    description: "Live availability and meeting creation.",
  },
  {
    name: "Microsoft Teams",
    category: "Messaging",
    status: "Considering",
    description: "Meeting links and handoff alerts for reps.",
  },
  {
    name: "Intercom",
    category: "Support",
    status: "Considering",
    description: "Pass support requests to the right team.",
  },
  {
    name: "Zendesk",
    category: "Support",
    status: "Considering",
    description: "Create tickets when a conversation is not sales.",
  },
];

export const integrationCategories: IntegrationCategory[] = [
  "CRM",
  "Messaging",
  "Email",
  "Calendar",
  "Commerce",
  "Support",
];

export const integrationStatusNotes: Record<IntegrationStatus, string> = {
  "In development": "Being built now.",
  Planned: "On the product roadmap.",
  Considering: "Under evaluation. Requests decide the order.",
};

export function integrationsByName(names: string[]) {
  return names.flatMap((name) =>
    integrations.filter((integration) => integration.name === name),
  );
}

export const marqueeRows = [
  [
    "HubSpot",
    "WhatsApp",
    "Google Calendar",
    "Salesforce",
    "Gmail",
    "Shopify",
    "Slack",
    "Zendesk",
  ],
  [
    "Instagram",
    "Pipedrive",
    "Outlook",
    "Calendly",
    "Stripe",
    "LinkedIn",
    "Intercom",
    "Microsoft Teams",
  ],
];

export const stackNames = [
  "HubSpot",
  "Salesforce",
  "Pipedrive",
  "Slack",
  "Shopify",
  "Stripe",
  "Calendly",
  "Intercom",
  "Zendesk",
];
