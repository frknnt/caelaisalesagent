import { MessageCircleQuestionMark } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { Accordion } from "@/components/ui/Accordion";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { FaqItem } from "@/types/content";

interface FaqSectionProps {
  items: FaqItem[];
  description: string;
  defaultOpen?: string;
}

export function FaqSection({
  items,
  description,
  defaultOpen,
}: FaqSectionProps) {
  return (
    <Section width="faq" labelledBy="faq-heading">
      <Reveal>
        <SectionHeading
          id="faq-heading"
          eyebrow="FAQ"
          before="Frequently Asked"
          icon={MessageCircleQuestionMark}
          after="Questions"
          description={description}
        />
      </Reveal>
      <Reveal className="mt-9">
        <Accordion items={items} {...(defaultOpen ? { defaultOpen } : {})} />
      </Reveal>
    </Section>
  );
}
