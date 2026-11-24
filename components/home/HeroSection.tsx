import { CalendarClock } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { ButtonLink } from "@/components/ui/Button";
import { hero } from "@/data/home-content";
import { routes } from "@/data/navigation";

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="pt-6 sm:pt-9">
      <PageContainer className="text-center">
        <p className="text-cyan-ink text-[1.0625rem] font-medium">
          {hero.eyebrow}
        </p>
        <h1 id="hero-heading" className="display-xl mt-4">
          <span className="block font-light">Turn Every Conversation</span>
          <span className="block font-semibold">
            Into <span className="text-revenue">Revenue</span>
          </span>
        </h1>
        <p className="text-body mx-auto mt-6 max-w-[44rem] text-[1.0625rem] sm:text-lg">
          {hero.description}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
          <ButtonLink
            href={routes.startFree}
            size="lg"
            className="w-full max-w-80 sm:w-auto"
          >
            {hero.primary}
          </ButtonLink>
          <ButtonLink href={routes.bookDemo} variant="quiet">
            <CalendarClock className="size-5" aria-hidden="true" />
            {hero.secondary}
          </ButtonLink>
        </div>
        <p className="text-body mt-5 text-[0.9375rem]">{hero.trust}</p>
      </PageContainer>
    </section>
  );
}
