import { Rocket } from "lucide-react";

import { StartFreeForm } from "@/components/forms/StartFreeForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { Panel } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Start Free",
  description:
    "Choose what your first AI sales agent should do, where it should start, and request your workspace.",
  path: "/start-free",
});

const nextSteps = [
  {
    title: "We review your request",
    description: "Access is by invitation while Cael is in early access.",
  },
  {
    title: "You get a workspace invitation",
    description: "It goes to your work email and is valid for seven days.",
  },
  {
    title: "You build and test",
    description: "Add approved sources and try real questions in preview.",
  },
];

export default function StartFreePage() {
  return (
    <>
      <PageHero
        before="Build Your First"
        icon={Rocket}
        after="Sales Agent"
        description="Pick a job and a channel. No credit card required."
      />
      <PageContainer className="pb-8">
        <Panel>
          <StartFreeForm />
        </Panel>
      </PageContainer>
      <Section labelledBy="next-heading">
        <SectionHeading id="next-heading" before="What happens next" />
        <ol className="mt-9 grid gap-2.5 md:grid-cols-3">
          {nextSteps.map((step) => (
            <li
              key={step.title}
              className="rounded-card border-line border bg-linear-to-b from-[#f4f5f8] to-white p-8"
            >
              <h3 className="text-xl font-medium">{step.title}</h3>
              <p className="text-body mt-2">{step.description}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
