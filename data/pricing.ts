import type { PricingPlan, PricingRow } from "@/types/content";

import { routes } from "./navigation";

export const pricingPlans: PricingPlan[] = [
  {
    id: "build",
    name: "Build",
    audience: "One site, one agent",
    price: "Free",
    priceNote: "No credit card required",
    description: "Set up an agent, teach it, and test it before you publish.",
    features: [
      "One agent in any mode",
      "Approved knowledge sources",
      "Preview conversations",
      "Human handoff",
    ],
    cta: { label: "Start Free", href: routes.startFree },
  },
  {
    id: "team",
    name: "Team",
    audience: "A sales team with one brand",
    price: "Custom quote",
    priceNote: "Based on channels and conversations",
    description: "Run several agents across channels with a shared inbox.",
    features: [
      "Everything in Build",
      "Several agents and channels",
      "Shared inbox with roles",
      "CRM and calendar connections",
      "Qualification rules and routing",
    ],
    cta: { label: "Request a Quote", href: "/contact?topic=sales" },
  },
  {
    id: "scale",
    name: "Scale",
    audience: "Agencies and multi-site companies",
    price: "Custom quote",
    priceNote: "Scoped with your team",
    description: "Keep many sites separate under one account.",
    features: [
      "Everything in Team",
      "Separate workspaces per client or site",
      "Retention settings per workspace",
      "Activity history export",
      "Guided rollout",
    ],
    cta: { label: "Book a Demo", href: routes.bookDemo },
  },
];

export const pricingRows: PricingRow[] = [
  {
    label: "Agents",
    values: { build: "1", team: "Several", scale: "Per workspace" },
  },
  {
    label: "Channels",
    values: { build: "Web preview", team: "Multiple", scale: "Multiple" },
  },
  {
    label: "Approved knowledge sources",
    values: { build: "Included", team: "Included", scale: "Included" },
  },
  {
    label: "Human handoff",
    values: { build: "Included", team: "Included", scale: "Included" },
  },
  {
    label: "Team roles",
    values: {
      build: "Owner only",
      team: "All five roles",
      scale: "All five roles",
    },
  },
  {
    label: "CRM and calendar connections",
    values: { build: "Not included", team: "Included", scale: "Included" },
  },
  {
    label: "Separate client workspaces",
    values: { build: "Not included", team: "Not included", scale: "Included" },
  },
  {
    label: "Retention settings",
    values: { build: "Default", team: "Configurable", scale: "Per workspace" },
  },
];

export const teamShapes = [
  { id: "build", label: "Just me" },
  { id: "team", label: "A sales team" },
  { id: "scale", label: "Several brands" },
] as const;
