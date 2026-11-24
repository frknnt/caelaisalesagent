import {
  CalendarCheck,
  Globe,
  Database,
  History,
  ListChecks,
  Mail,
  MessageCircle,
  Camera,
  Plug,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  Archive,
  Workflow,
} from "lucide-react";

import type { AgentMode, IconPoint } from "@/types/content";

export const hero = {
  eyebrow: "Your AI sales team, always on",
  description:
    "Cael AI Sales Agent engages every lead, qualifies intent, answers product questions, follows up instantly, and books meetings around the clock.",
  primary: "Start Building Free",
  secondary: "Book a Demo",
  trust:
    "No credit card required. Launch your first AI sales agent in minutes.",
};

export const channelBadges: IconPoint[] = [
  { icon: Globe, title: "Web" },
  { icon: MessageCircle, title: "WhatsApp" },
  { icon: Camera, title: "Instagram" },
  { icon: Mail, title: "Email" },
  { icon: Smartphone, title: "SMS" },
  { icon: Database, title: "CRM" },
  { icon: CalendarCheck, title: "Calendar" },
];

export const workflowPoints: IconPoint[] = [
  {
    icon: Rocket,
    title: "Launch without rebuilding your sales workflow",
  },
  {
    icon: ListChecks,
    title: "Qualify leads using your own sales criteria",
  },
  {
    icon: RefreshCw,
    title: "Keep every conversation synchronized with your CRM",
  },
  {
    icon: UserCheck,
    title: "Hand high-intent opportunities to the right rep instantly",
  },
];

export const securityPoints: IconPoint[] = [
  { icon: Users, title: "Role-based access" },
  { icon: UserCheck, title: "Controlled human handoff" },
  { icon: History, title: "Audit-friendly activity history" },
  { icon: Archive, title: "Configurable data retention" },
  { icon: Plug, title: "Secure integration boundaries" },
  { icon: Workflow, title: "Permission-aware workflows" },
];

export const securityIcon = ShieldCheck;

export const agentModes: AgentMode[] = [
  {
    id: "qualifier",
    name: "Qualifier",
    tagline: "Finds fit and intent",
    summary:
      "Asks the questions your team would ask, one at a time, and scores the answers against criteria you define.",
    handles: [
      "Budget, timeline, and team-size questions",
      "Fit checks against your own rules",
      "A short, readable lead summary",
    ],
    handsOver: "When a lead meets your qualified threshold.",
  },
  {
    id: "inbound-sdr",
    name: "Inbound SDR",
    tagline: "Answers first",
    summary:
      "Greets new visitors, says it is an AI, and answers product questions from the knowledge you approve.",
    handles: [
      "First replies on every enabled channel",
      "Product answers with the source attached",
      "Routing by territory, segment, or product",
    ],
    handsOver: "When a visitor asks for a person or a custom quote.",
  },
  {
    id: "follow-up",
    name: "Follow-Up Agent",
    tagline: "Keeps deals moving",
    summary:
      "Picks up quiet conversations with a message based on what the lead last asked about, not a generic nudge.",
    handles: [
      "Timed follow-ups with a clear stop rule",
      "Context from earlier conversations",
      "Opt-out handling before every message",
    ],
    handsOver: "When a lead replies with a question about terms.",
  },
  {
    id: "meeting-booker",
    name: "Meeting Booker",
    tagline: "Fills the calendar",
    summary:
      "Offers times that are actually free on the owner’s calendar and confirms the meeting inside the conversation.",
    handles: [
      "Live availability from the connected calendar",
      "Time zones, reminders, and reschedules",
      "A briefing for the rep before the call",
    ],
    handsOver: "When no suitable time is available.",
  },
  {
    id: "reactivation",
    name: "Reactivation Agent",
    tagline: "Reopens old interest",
    summary:
      "Reconnects with past opportunities when something relevant to their original question has changed.",
    handles: [
      "Lists built from closed or stalled deals",
      "Messages tied to the original objection",
      "Consent checks before any outreach",
    ],
    handsOver: "As soon as a past lead shows new intent.",
  },
];
