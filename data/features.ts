import {
  Bot,
  Eye,
  FileText,
  Hand,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";

import type { DetailPoint } from "@/types/content";

export const guardrails: DetailPoint[] = [
  {
    icon: Bot,
    title: "It says it is an AI",
    description:
      "Every first message discloses that the visitor is talking to an AI agent.",
  },
  {
    icon: FileText,
    title: "Answers show their source",
    description:
      "Product answers come from pages and documents your team has approved.",
  },
  {
    icon: ShieldCheck,
    title: "No invented prices or slots",
    description:
      "Prices, stock, and availability are read from your systems, never guessed.",
  },
  {
    icon: Hand,
    title: "A person is always reachable",
    description:
      "Visitors can ask for a rep at any point. Once a rep joins, the agent is silent.",
  },
  {
    icon: SlidersHorizontal,
    title: "Rules decide, not mood",
    description:
      "Scores, routing, and limits follow the criteria you set, the same way every time.",
  },
  {
    icon: Eye,
    title: "Nothing publishes itself",
    description:
      "Suggested replies, forms, and knowledge changes wait for human approval.",
  },
];
