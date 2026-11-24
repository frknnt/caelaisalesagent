import { Users } from "lucide-react";

import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Customer Stories",
  description:
    "How Cael publishes customer stories, with worked example scenarios for agencies, manufacturers, and education teams.",
  path: "/customer-stories",
});

const scenarios = [
  {
    audience: "Agency",
    title: "Many clients, one team of reps",
    situation:
      "Visitors on each client’s site ask about scope and timelines outside office hours.",
    agent:
      "Answers from that client’s approved pages, asks about goals and dates, and keeps each workspace separate.",
    handoff: "Custom scope questions go to the account lead with a summary.",
  },
  {
    audience: "B2B manufacturer",
    title: "Technical questions before a quote",
    situation:
      "Buyers want to know whether a product fits their specification before they talk to sales.",
    agent:
      "Answers from data sheets, collects the specification, and reads availability from the connected system.",
    handoff: "Pricing and volume terms always go to a rep.",
  },
  {
    audience: "Education",
    title: "Admissions season, every evening",
    situation:
      "Applicants compare programs at night and need to book a call with an advisor.",
    agent:
      "Explains programs from approved pages and offers times from the advisor’s calendar.",
    handoff: "Eligibility decisions stay with the admissions team.",
  },
];

export default function CustomerStoriesPage() {
  return (
    <>
      <PageHero
        before="Stories Worth"
        icon={Users}
        after="Believing"
        description="We publish a customer story only when the customer has approved it and the numbers can be checked. None are published yet, so here are worked examples instead."
      />
      <PageContainer className="pb-8">
        <Panel>
          <PanelHeader
            title="Example scenarios"
            description="Illustrations of how Cael is meant to be used, not customer results."
          />
          <div className="grid gap-1.5 sm:gap-2 lg:grid-cols-3">
            {scenarios.map((scenario) => (
              <Card
                key={scenario.title}
                as="article"
                className="flex flex-col p-8 sm:p-10"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge tone="violet">{scenario.audience}</Badge>
                  <Badge>Example</Badge>
                </div>
                <h3 className="mt-7 text-2xl leading-tight font-medium">
                  {scenario.title}
                </h3>
                <dl className="mt-6 space-y-5">
                  <div>
                    <dt className="font-semibold">Situation</dt>
                    <dd className="text-body">{scenario.situation}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">What the agent does</dt>
                    <dd className="text-body">{scenario.agent}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">What a person decides</dt>
                    <dd className="text-body">{scenario.handoff}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </Panel>
      </PageContainer>
      <FinalCta
        title="Want to Be the First Story?"
        description="Start with one agent on one page and measure it against what you do today."
      />
    </>
  );
}
