import { Link2 } from "lucide-react";

import { IntegrationGlyph } from "@/components/content/IntegrationGlyph";
import { Section } from "@/components/layout/Section";
import { DriftRow } from "@/components/motion/DriftRow";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Disc } from "@/components/ui/Disc";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { integrationsByName, marqueeRows } from "@/data/integrations";

const drift = [
  { from: -20, to: -240 },
  { from: -240, to: -20 },
];

export function IntegrationMarquee() {
  return (
    <Section labelledBy="integrations-heading">
      <div className="mx-auto max-w-[56rem] overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)] py-1">
        <div className="space-y-3">
          {marqueeRows.map((names, index) => {
            const range = drift[index] ?? { from: 0, to: -200 };
            return (
              <DriftRow key={names.join()} from={range.from} to={range.to}>
                <ul
                  aria-label={`Sales tools, group ${index + 1}`}
                  className="flex w-max gap-3"
                >
                  {integrationsByName(names).map((item) => (
                    <li
                      key={item.name}
                      className="border-line flex items-center gap-3.5 rounded-full border bg-linear-to-b from-[#f4f5f7] to-[#fafbfc] py-2 pr-7 pl-2 text-[1.0625rem] font-medium whitespace-nowrap"
                    >
                      <Disc>
                        <IntegrationGlyph
                          category={item.category}
                          className="size-6"
                        />
                      </Disc>
                      {item.name}
                    </li>
                  ))}
                </ul>
              </DriftRow>
            );
          })}
        </div>
      </div>

      <Reveal className="mt-12 sm:mt-14">
        <SectionHeading
          id="integrations-heading"
          eyebrow="Integrations"
          before="Connect Cael to the"
          icon={Link2}
          after="Tools That Run Your Revenue"
          description="Keep conversations, lead data, meetings, and pipeline activity synchronized across your existing sales stack."
          wide
        />
        <div className="mt-9 text-center">
          <ButtonLink href="/integrations" size="lg">
            Explore All Integrations
          </ButtonLink>
        </div>
      </Reveal>
    </Section>
  );
}
