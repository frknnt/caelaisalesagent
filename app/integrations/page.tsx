import { Database, Link2, Plug, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { IntegrationDirectory } from "@/components/content/IntegrationDirectory";
import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disc } from "@/components/ui/Disc";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Integrations",
  description:
    "CRM, messaging, email, calendar, commerce, and support connections for Cael, with the current status of each.",
  path: "/integrations",
});

interface SyncRule {
  icon: LucideIcon;
  title: string;
  description: string;
}

const syncRules: SyncRule[] = [
  {
    icon: Database,
    title: "Your systems stay the source",
    description:
      "Prices, availability, and deal stages are read from the connected tool. If it does not answer, the agent says so and brings in a person.",
  },
  {
    icon: ShieldCheck,
    title: "Access stays narrow",
    description:
      "A connection belongs to one workspace, and its credentials stay on the server. One client’s data is never visible to another.",
  },
  {
    icon: Plug,
    title: "Failures are visible",
    description:
      "When a sync fails, the record shows it and the update is retried. Nothing is reported as saved until it is.",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        before="Works With the"
        icon={Link2}
        after="Tools You Already Run"
        description="Every connection below shows where it stands today, so you can plan a rollout around what is real."
      />
      <section aria-labelledby="directory-heading" className="pb-10">
        <PageContainer>
          <h2 id="directory-heading" className="sr-only">
            Integration directory
          </h2>
          <IntegrationDirectory />
          <p className="text-body mt-6 text-center text-[0.9375rem]">
            Product names belong to their owners. Listing them does not imply a
            partnership or endorsement.
          </p>
        </PageContainer>
      </section>

      <Section labelledBy="sync-heading">
        <Panel>
          <PanelHeader
            id="sync-heading"
            title="How a connection behaves"
            description="The same three rules for every tool."
          />
          <StaggerGrid className="grid gap-1.5 sm:gap-2 lg:grid-cols-3">
            {syncRules.map(({ icon: Icon, title, description }) => (
              <div key={title} className="h-full">
                <Card className="h-full p-8 sm:p-10">
                  <Disc>
                    <Icon className="size-6" strokeWidth={1.9} />
                  </Disc>
                  <h3 className="mt-6 text-xl font-medium">{title}</h3>
                  <p className="text-body mt-2">{description}</p>
                </Card>
              </div>
            ))}
          </StaggerGrid>
        </Panel>
      </Section>

      <Section labelledBy="request-heading">
        <div className="rounded-panel border-line bg-mist flex flex-col gap-6 border p-7 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="request-heading" className="display-md font-normal">
              Need a tool that is not listed?
            </h2>
            <p className="text-body mt-3 max-w-2xl">
              Tell us what it does in your sales process. Requests decide what
              we connect next.
            </p>
          </div>
          <ButtonLink href="/contact?topic=integration" size="lg">
            Request an Integration
          </ButtonLink>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
