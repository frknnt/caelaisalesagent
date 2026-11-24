import { Section } from "@/components/layout/Section";
import { LogoCloud } from "@/components/ui/LogoCloud";
import { integrationsByName, stackNames } from "@/data/integrations";

export function StackSection() {
  return (
    <Section labelledBy="stack-heading">
      <h2
        id="stack-heading"
        className="text-body text-center font-sans text-[1.0625rem] font-medium tracking-normal"
      >
        Built to Work With Your Sales Stack
      </h2>
      <div className="mt-6">
        <LogoCloud
          items={integrationsByName(stackNames)}
          label="Sales tools Cael is built to work with"
        />
      </div>
    </Section>
  );
}
