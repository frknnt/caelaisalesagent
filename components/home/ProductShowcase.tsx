import { CalendarCheck, Database, Globe, Mail } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { FloatingElement } from "@/components/motion/FloatingElement";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { ConversationMockup } from "@/components/product/ConversationMockup";
import { LeadProfileCard } from "@/components/product/LeadProfileCard";
import { MeetingCard } from "@/components/product/MeetingCard";
import { Disc } from "@/components/ui/Disc";
import { PhoneMockup } from "@/components/ui/PhoneMockup";

/** Layered hero visual. It sits flush on the panel that follows. */
export function ProductShowcase() {
  return (
    <div className="relative overflow-x-clip pt-10 sm:pt-14">
      <svg
        viewBox="0 0 1200 700"
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute bottom-0 left-1/2 hidden w-[75rem] max-w-none -translate-x-1/2 md:block"
      >
        <defs>
          <linearGradient id="halo" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#eff3f7" />
            <stop offset="62%" stopColor="#f3f6f9" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <path
          d="M175 700V575A425 355 0 0 1 1025 575V700"
          fill="none"
          stroke="url(#halo)"
          strokeWidth="165"
        />
      </svg>

      <PageContainer className="relative">
        <div
          role="img"
          aria-label="Example of Cael at work: a phone shows a lead scored 86 out of 100 while the AI agent answers from an approved guide and offers a meeting. Beside it, a lead profile marked high intent and a booked discovery call with the CRM updated."
          className="relative flex justify-center"
        >
          <div className="settle relative z-10 w-full max-w-[22.5rem] sm:max-w-[25rem] lg:max-w-[22.5rem] xl:max-w-[27.5rem]">
            <PhoneMockup>
              <ConversationMockup />
            </PhoneMockup>
          </div>

          <div className="absolute bottom-24 -left-4 z-20 hidden w-[19.5rem] lg:block xl:left-[5rem] xl:w-[22rem]">
            <ParallaxLayer distance={-46} rotate={3}>
              <div className="settle rotate-[-8deg] [animation-delay:140ms]">
                <LeadProfileCard />
              </div>
            </ParallaxLayer>
          </div>

          <div className="absolute top-28 -right-4 z-20 hidden w-[19.5rem] lg:block xl:right-[4rem] xl:w-[23.5rem]">
            <ParallaxLayer distance={-70} rotate={-3}>
              <div className="settle rotate-[6deg] [animation-delay:240ms]">
                <MeetingCard />
              </div>
            </ParallaxLayer>
          </div>

          <div className="absolute top-2 left-[6%] hidden lg:block xl:left-[14%]">
            <FloatingElement>
              <Disc>
                <Globe className="text-cyan-ink size-6" />
              </Disc>
            </FloatingElement>
          </div>
          <div className="absolute top-[17rem] left-[2%] hidden xl:block xl:left-[9%]">
            <FloatingElement delay={0.4}>
              <Disc size="sm">
                <Mail className="text-violet size-5" />
              </Disc>
            </FloatingElement>
          </div>
          <div className="absolute right-[4%] bottom-[8.5rem] hidden lg:block xl:right-[13%]">
            <FloatingElement delay={0.25}>
              <Disc>
                <Database className="text-mint-ink size-6" />
              </Disc>
            </FloatingElement>
          </div>
          <div className="absolute top-3 right-[6%] hidden xl:right-[18%] xl:block">
            <FloatingElement delay={0.55}>
              <Disc size="sm">
                <CalendarCheck className="text-amber-ink size-5" />
              </Disc>
            </FloatingElement>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
