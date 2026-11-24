import { Layers } from "lucide-react";
import type { ReactNode } from "react";

import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Reveal } from "@/components/motion/Reveal";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { AgentDashboardMockup } from "@/components/product/AgentDashboardMockup";
import { AnalyticsCard } from "@/components/product/AnalyticsCard";
import { PipelineMockup } from "@/components/product/PipelineMockup";
import { QualificationMockup } from "@/components/product/QualificationMockup";
import { AgentModeTabs } from "@/components/ui/AgentModeTabs";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disc } from "@/components/ui/Disc";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { guardrails } from "@/data/features";
import { routes } from "@/data/navigation";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Features",
  description:
    "See how Cael answers, qualifies, follows up, books meetings, and hands conversations to your sales team.",
  path: "/features",
});

interface FeatureRowProps {
  id: string;
  title: string;
  description: string;
  points: string[];
  visual: ReactNode;
  visualLabel: string;
  flip?: boolean;
}

function FeatureRow({
  id,
  title,
  description,
  points,
  visual,
  visualLabel,
  flip = false,
}: FeatureRowProps) {
  return (
    <Section labelledBy={id}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className={flip ? "lg:order-2" : ""}>
          <h2 id={id} className="display-md font-normal">
            {title}
          </h2>
          <p className="text-body mt-4 max-w-xl text-[1.0625rem]">
            {description}
          </p>
          <ul className="mt-7 max-w-xl space-y-2.5">
            {points.map((point) => (
              <li
                key={point}
                className="border-line flex min-h-14 items-center rounded-full border bg-linear-to-b from-[#f4f5f8] to-[#f9fafb] px-6 py-3 leading-snug font-medium"
              >
                {point}
              </li>
            ))}
          </ul>
        </Reveal>
        <div
          role="img"
          aria-label={visualLabel}
          className="rounded-panel border-line border bg-linear-to-b from-[#e2e4e9] to-[#f5f6f8] px-4 py-10 sm:px-12 sm:py-16"
        >
          <div className="mx-auto max-w-md">{visual}</div>
        </div>
      </div>
    </Section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        before="One Agent for the"
        icon={Layers}
        after="Whole Conversation"
        description="From the first question to a booked meeting, Cael keeps answers sourced, criteria consistent, and your reps in control."
      >
        <ButtonLink href={routes.startFree} size="lg">
          Start Building Free
        </ButtonLink>
        <ButtonLink href={routes.bookDemo} variant="quiet">
          Book a Demo
        </ButtonLink>
      </PageHero>

      <PageContainer className="pb-10">
        <div
          role="img"
          aria-label="Example inbox: a list of conversations, a chat where the agent answers with sources and offers a meeting, and the lead’s context and activity."
          className="rounded-panel border-line relative isolate overflow-hidden border bg-[#eceef1] px-3 pt-8 sm:px-10 sm:pt-12"
        >
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(20%_70%_at_0%_70%,rgb(51_195_222/0.6),transparent),radial-gradient(18%_60%_at_0%_20%,rgb(138_124_245/0.45),transparent),radial-gradient(20%_70%_at_100%_80%,rgb(251_160_11/0.6),transparent)]" />
          <ParallaxLayer distance={-18}>
            <div className="-mb-6 pb-0">
              <AgentDashboardMockup />
            </div>
          </ParallaxLayer>
        </div>
      </PageContainer>

      <FeatureRow
        id="qualification"
        title="Qualification you can explain"
        description="Every score is the sum of criteria you chose. If the lead did not say, the score says so too."
        points={[
          "Your own fit, need, timing, and budget rules",
          "The same answers always give the same score",
          "Unknown stays unknown",
        ]}
        visualLabel="Example lead score of 86: fit 30, need 26, timing 30, and budget not discussed."
        visual={<QualificationMockup />}
      />

      <FeatureRow
        id="intelligence"
        flip
        title="Hear what buyers keep asking"
        description="Cael groups questions and objections by topic, in the lead’s own words, so you know which page or answer to fix next."
        points={[
          "Topics and objections from real conversations",
          "Links back to the messages behind each topic",
          "Suggested answers wait for your approval",
        ]}
        visualLabel="Example chart of topics leads ask about in a week: pricing and terms 31, integrations 24, rollout time 17, security review 11."
        visual={<AnalyticsCard />}
      />

      <Section labelledBy="pipeline-heading">
        <Panel>
          <PanelHeader
            id="pipeline-heading"
            title="Every opportunity has an owner"
            description="The agent works new leads. Reps own what is qualified."
          />
          <div
            role="img"
            aria-label="Example pipeline with three stages: new leads with the AI agent, one qualified lead with a rep, and two deals with reps."
            className="rounded-card bg-paper p-3 sm:p-6"
          >
            <PipelineMockup />
          </div>
        </Panel>
      </Section>

      <Section labelledBy="feature-modes-heading">
        <Reveal>
          <SectionHeading
            id="feature-modes-heading"
            before="A mode for each sales motion"
            description="Start with one. Add others when the first is working."
          />
          <div className="mt-10">
            <AgentModeTabs />
          </div>
        </Reveal>
      </Section>

      <Section labelledBy="guardrails-heading">
        <Panel>
          <PanelHeader
            id="guardrails-heading"
            layout="stacked"
            title="Guardrails that come with every agent"
            description="These are product rules, not settings. They apply to every mode and every channel."
          />
          <StaggerGrid className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3">
            {guardrails.map(({ icon: Icon, title, description }) => (
              <div key={title} className="h-full">
                <Card className="h-full p-8 sm:p-10">
                  <Disc size="md">
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

      <FinalCta />
    </>
  );
}
