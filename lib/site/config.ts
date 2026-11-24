import { readRuntimeConfig } from "@/lib/env";

export const siteConfig = {
  name: "Cael AI Sales Agent",
  shortName: "Cael",
  description:
    "AI-powered sales agents that engage leads, qualify intent, answer questions, follow up, book meetings, and move opportunities forward across every customer channel.",
} as const;

/** Public origin for metadata. Builds never need a production env value. */
export function getSiteOrigin() {
  const runtime = readRuntimeConfig(process.env, process.env.NODE_ENV);
  return runtime.ok ? runtime.value.appBaseUrl : "http://localhost:3000";
}
