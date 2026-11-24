import { Section } from "@/components/layout/Section";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import {
  CriteriaVisual,
  CrmSyncVisual,
  FollowUpVisual,
  HandoffVisual,
  IntelligenceVisual,
  OmnichannelVisual,
} from "@/components/product/BentoVisuals";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Panel, PanelHeader } from "@/components/ui/Panel";

export function WhyCaelSection() {
  return (
    <Section labelledBy="why-heading">
      <Panel>
        <PanelHeader
          id="why-heading"
          layout="stacked"
          title="Why Teams Choose Cael"
          description="Cael is more than a chat window. It carries one conversation from the first question to a booked meeting, keeps your records in step, and knows when to bring in a person."
        />
        <StaggerGrid className="grid gap-1.5 sm:gap-2 md:grid-cols-2 xl:grid-cols-3">
          <FeatureCard
            title="Omnichannel Conversations"
            description="Web, messaging, email, and phone context stay in one thread per lead."
            visual={<OmnichannelVisual />}
            copy="bottom"
          />
          <FeatureCard
            title="Intelligent Lead Qualification"
            description="Scores follow your own criteria, so the same answers always give the same result."
            visual={<CriteriaVisual />}
            className="max-xl:min-h-[30rem]"
          />
          <FeatureCard
            title="Automated Follow-Up"
            description="Messages pick up where the lead left off, and stop when they should."
            visual={<FollowUpVisual />}
            copy="bottom"
          />
          <FeatureCard
            title="Real-Time CRM Sync"
            description="Contacts, deals, and activity update as the conversation happens."
            visual={<CrmSyncVisual />}
          />
          <FeatureCard
            title="Human Handoff"
            description="A rep takes over with full context, and the agent goes silent at once."
            visual={<HandoffVisual />}
            copy="bottom"
          />
          <FeatureCard
            title="Conversation Intelligence"
            description="See which questions and objections come up, in the lead’s own words."
            visual={<IntelligenceVisual />}
          />
        </StaggerGrid>
      </Panel>
    </Section>
  );
}
