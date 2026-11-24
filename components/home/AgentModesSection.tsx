import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { AgentModeTabs } from "@/components/ui/AgentModeTabs";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function AgentModesSection() {
  return (
    <Section labelledBy="modes-heading">
      <Reveal>
        <SectionHeading
          id="modes-heading"
          before="One Platform, Multiple Sales Motions"
          description="Configure specialized agents for each stage of your buyer journey while keeping context unified."
        />
        <div className="mt-10">
          <AgentModeTabs />
        </div>
      </Reveal>
    </Section>
  );
}
