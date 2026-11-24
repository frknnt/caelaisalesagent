import { AgentModesSection } from "@/components/home/AgentModesSection";
import { CapabilitiesBento } from "@/components/home/CapabilitiesBento";
import { FaqSection } from "@/components/home/FaqSection";
import { FinalCta } from "@/components/home/FinalCta";
import { HeroSection } from "@/components/home/HeroSection";
import { IntegrationMarquee } from "@/components/home/IntegrationMarquee";
import { OmnichannelSection } from "@/components/home/OmnichannelSection";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { SecuritySection } from "@/components/home/SecuritySection";
import { StackSection } from "@/components/home/StackSection";
import { WhyCaelSection } from "@/components/home/WhyCaelSection";
import { WorkflowSection } from "@/components/home/WorkflowSection";
import { homeFaq } from "@/data/faq";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Cael AI Sales Agent — Turn Conversations Into Revenue",
  absoluteTitle: true,
  description:
    "Engage leads, qualify intent, automate follow-up, and book more meetings with Cael AI Sales Agent.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProductShowcase />
      <CapabilitiesBento />
      <IntegrationMarquee />
      <WhyCaelSection />
      <OmnichannelSection />
      <StackSection />
      <WorkflowSection />
      <SecuritySection />
      <AgentModesSection />
      <FaqSection
        items={homeFaq}
        defaultOpen="existing-crm"
        description="Straight answers about what Cael does, who stays in control, and how it fits your stack."
      />
      <FinalCta />
    </>
  );
}
