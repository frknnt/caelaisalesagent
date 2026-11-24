import { PageContainer } from "@/components/layout/PageContainer";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import {
  MeetingDialVisual,
  MomentumVisual,
  QualifyVisual,
} from "@/components/product/BentoVisuals";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Panel, PanelHeader } from "@/components/ui/Panel";

export function CapabilitiesBento() {
  return (
    <section
      aria-labelledby="capabilities-heading"
      className="relative z-10 pb-10 sm:pb-14"
    >
      <PageContainer>
        <Panel>
          <PanelHeader
            id="capabilities-heading"
            title="Everything Your Sales Team Needs"
            description="One agent for the first question, the follow-up, and the meeting."
          />
          <StaggerGrid className="grid gap-1.5 sm:gap-2 md:grid-cols-2 xl:grid-cols-3">
            <FeatureCard
              title="Qualify Leads Automatically"
              description="Identify buying intent, budget, urgency, and fit while the conversation is still active."
              visual={<QualifyVisual />}
              className="min-h-[29rem] sm:min-h-[29rem]"
            />
            <FeatureCard
              title="Keep Every Opportunity Moving"
              description="Follow up automatically with relevant messages based on each lead’s context and behavior."
              visual={<MomentumVisual />}
              copy="bottom"
              className="xl:min-h-[29rem]"
            />
            <FeatureCard
              title="Book Meetings Instantly"
              description="Offer available times and schedule qualified prospects directly into your team’s calendar."
              visual={<MeetingDialVisual />}
              className="min-h-[29rem] md:max-xl:col-span-2 md:max-xl:min-h-[21rem] sm:min-h-[29rem]"
            />
          </StaggerGrid>
        </Panel>
      </PageContainer>
    </section>
  );
}
