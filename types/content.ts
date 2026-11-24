import type { LucideIcon } from "lucide-react";

import type { CallToAction } from "./site";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface IconPoint {
  icon: LucideIcon;
  title: string;
}

export interface DetailPoint extends IconPoint {
  description: string;
}

export interface AgentMode {
  id: string;
  name: string;
  tagline: string;
  summary: string;
  handles: string[];
  handsOver: string;
}

export type IntegrationCategory =
  "CRM" | "Messaging" | "Email" | "Calendar" | "Commerce" | "Support";

export type IntegrationStatus = "In development" | "Planned" | "Considering";

export interface Integration {
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  description: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  audience: string;
  price: string;
  priceNote: string;
  description: string;
  features: string[];
  cta: CallToAction;
}

export interface PricingRow {
  label: string;
  values: Record<string, string>;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  readingTime: string;
  intro: string;
  sections: ArticleSection[];
}
