import { CalendarClock } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { CornerDots } from "@/components/ui/CornerDots";
import { routes } from "@/data/navigation";

interface FinalCtaProps {
  title?: string;
  description?: string;
}

export function FinalCta({
  title = "Your Next Customer Is Already Starting a Conversation",
  description = "Give every qualified opportunity an immediate, helpful, and consistent sales experience.",
}: FinalCtaProps) {
  return (
    <Section labelledBy="final-cta-heading">
      <Reveal>
        <div className="rounded-panel border-line relative isolate overflow-hidden border bg-[#f3f4f7] px-5 py-16 text-center sm:px-10 sm:py-24">
          <span
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(22%_75%_at_0%_75%,rgb(51_195_222/0.55),transparent),radial-gradient(18%_65%_at_0%_15%,rgb(138_124_245/0.42),transparent),radial-gradient(22%_85%_at_100%_80%,rgb(251_160_11/0.6),transparent)]"
          />
          <CornerDots />
          <h2
            id="final-cta-heading"
            className="display-lg mx-auto max-w-[46rem] font-normal"
          >
            {title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[1.0625rem] text-balance text-[#3f454f]">
            {description}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <ButtonLink href={routes.startFree} size="lg">
              Start Building Free
            </ButtonLink>
            <ButtonLink href={routes.bookDemo} variant="quiet">
              <CalendarClock className="size-5" aria-hidden="true" />
              Book a Demo
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
