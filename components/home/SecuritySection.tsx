import { ShieldCheck } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { ControlSwitch } from "@/components/product/ControlSwitch";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { securityPoints } from "@/data/home-content";

export function SecuritySection() {
  return (
    <Section labelledBy="security-heading">
      <Reveal>
        <ControlSwitch />
        <SectionHeading
          id="security-heading"
          className="mt-8"
          eyebrow="Secure by Design"
          before="Your Customer"
          icon={ShieldCheck}
          after="Conversations Stay Under Your Control"
          description="Protect customer data with controlled access, secure integrations, auditable activity, and configurable retention policies."
          wide
        />
        <ul className="mx-auto mt-9 flex max-w-4xl flex-wrap justify-center gap-x-3 gap-y-2.5">
          {securityPoints.map(({ icon: Icon, title }) => (
            <li
              key={title}
              className="border-line bg-mist flex min-h-12 items-center gap-2.5 rounded-full border px-5 text-[0.9375rem] font-medium"
            >
              <Icon
                className="size-5 text-[#3b404a]"
                strokeWidth={1.9}
                aria-hidden="true"
              />
              {title}
            </li>
          ))}
        </ul>
        <div className="mt-9 text-center">
          <ButtonLink href="/security" size="lg">
            Explore Security
          </ButtonLink>
        </div>
      </Reveal>
    </Section>
  );
}
