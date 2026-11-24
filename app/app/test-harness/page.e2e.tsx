import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";

import { requireHarness } from "./harness-access";

export const metadata: Metadata = {
  title: "Test agent",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Stand-in for the agent screen (P1.6). Exists only in test builds. */
export default async function HarnessAgentPage() {
  const { activeMembership } = await requireHarness("/app/test-harness");
  const facts = [
    ["Workspace", activeMembership.organization_name],
    ["Model", "fake-model-1 (simulated)"],
    ["Identity", "Says it is an AI agent"],
    ["Handoff", "A person is always available"],
  ] as const;

  return (
    <PageContainer width="text" className="pt-8 pb-16 sm:pt-12">
      <Panel>
        <div className="rounded-card border-line bg-paper border p-5 sm:p-12">
          <Badge tone="amber">Test build only</Badge>
          <h1 className="display-md mt-4 font-normal">Test agent</h1>
          <p className="text-body mt-3 text-[1.0625rem]">
            A scripted agent for automated tests. No model, email, or CRM is
            called.
          </p>
          <dl className="divide-line mt-6 divide-y">
            {facts.map(([term, detail]) => (
              <div
                key={term}
                className="flex flex-wrap justify-between gap-x-4 py-3"
              >
                <dt className="text-body">{term}</dt>
                <dd className="font-semibold">{detail}</dd>
              </div>
            ))}
          </dl>
          <ButtonLink
            href="/app/test-harness/preview"
            size="lg"
            className="mt-8"
          >
            Open Preview
          </ButtonLink>
        </div>
      </Panel>
    </PageContainer>
  );
}
