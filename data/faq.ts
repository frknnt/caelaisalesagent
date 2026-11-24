import type { FaqItem } from "@/types/content";

export const homeFaq: FaqItem[] = [
  {
    id: "what-does-cael-do",
    question: "What does Cael AI Sales Agent do?",
    answer:
      "Cael engages inbound and outbound prospects, answers product questions, qualifies intent, follows up based on context, and books meetings for your sales team.",
  },
  {
    id: "existing-crm",
    question: "Can Cael work with our existing CRM?",
    answer:
      "Yes. Cael is designed to synchronize conversations and lead activity with common CRM and sales tools. The integrations page lists the current availability of each connection.",
  },
  {
    id: "human-takeover",
    question: "Can a human sales representative take over?",
    answer:
      "Yes. Teams can route conversations to a human representative when a lead reaches a specific intent level or requests personal assistance. Once a rep takes over, the agent stops replying.",
  },
  {
    id: "customize-messaging",
    question: "Can we customize the agent’s messaging?",
    answer:
      "Yes. Teams can configure brand voice, qualification criteria, approved product knowledge, escalation rules, and workflow behavior.",
  },
  {
    id: "multiple-channels",
    question: "Does Cael support multiple channels?",
    answer:
      "Cael is designed for web, messaging, email, CRM, and scheduling workflows, depending on the integrations enabled for your account.",
  },
];

export const pricingFaq: FaqItem[] = [
  {
    id: "why-no-prices",
    question: "Why are there no fixed prices on this page?",
    answer:
      "Paid plans are quoted while we finish usage-based billing. You will receive a written quote before anything is charged, and building your first agent stays free.",
  },
  {
    id: "credit-card",
    question: "Do I need a credit card to start?",
    answer:
      "No. You can set up an agent, add approved knowledge, and test conversations without adding a payment method.",
  },
  {
    id: "usage",
    question: "What counts as usage?",
    answer:
      "Plans are scoped by active agents, enabled channels, and monthly conversations. A conversation that a rep takes over still counts once.",
  },
  {
    id: "limits",
    question: "What happens when we reach a limit?",
    answer:
      "The agent does not improvise. New conversations fall back to your contact form or go straight to a rep, and account owners are notified.",
  },
  {
    id: "change-plan",
    question: "Can we change plans later?",
    answer:
      "Yes. You can move between plans as your number of channels, agents, or sites changes. Your knowledge and conversation history stay in place.",
  },
];

export const supportFaq: FaqItem[] = [
  {
    id: "first-agent",
    question: "How do I set up my first agent?",
    answer:
      "Choose an agent mode, add the pages and documents it may answer from, set your qualification questions, then test it in preview before you publish. The documentation walks through each step.",
  },
  {
    id: "wrong-answer",
    question: "The agent gave an answer I do not agree with. What now?",
    answer:
      "Open the conversation, check which source the answer used, and correct or remove that source. Nothing the agent drafts is published to your knowledge without a person approving it.",
  },
  {
    id: "take-over",
    question: "How do I take over a live conversation?",
    answer:
      "Select Take over in the inbox. The agent goes silent immediately and the visitor sees that a person has joined.",
  },
  {
    id: "invite",
    question: "How do I invite a teammate?",
    answer:
      "Owners and admins can send invitations and choose a role: admin, editor, sales, or viewer. Invitations expire after seven days.",
  },
  {
    id: "sign-in-trouble",
    question: "I cannot sign in. What should I check?",
    answer:
      "Make sure you use the email address your invitation was sent to. If your invitation expired, ask an owner or admin to send a new one.",
  },
];
