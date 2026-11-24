import { BookOpen, Rocket } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { ParallaxLayer } from "@/components/motion/ParallaxLayer";
import { Reveal } from "@/components/motion/Reveal";
import { NextActionScreen } from "@/components/product/ChannelScreens";
import { ButtonLink } from "@/components/ui/Button";
import { CornerDots } from "@/components/ui/CornerDots";
import { Disc } from "@/components/ui/Disc";
import { PhoneMockup } from "@/components/ui/PhoneMockup";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { workflowPoints } from "@/data/home-content";
import { routes } from "@/data/navigation";

export function WorkflowSection() {
  return (
    <Section labelledBy="workflow-heading">
      <div className="grid items-center gap-12 lg:grid-cols-[1.12fr_1fr] lg:gap-6 xl:gap-10">
        <Reveal>
          <SectionHeading
            id="workflow-heading"
            align="left"
            eyebrow="From first reply to full rollout"
            before="Simple to Launch."
            icon={Rocket}
            after="Powerful at Scale."
            description="Start with one agent on one page. Add channels, modes, and teammates when you are ready."
          />
          <ul className="mt-8 space-y-2.5">
            {workflowPoints.map(({ icon: Icon, title }) => (
              <li
                key={title}
                className="border-line flex min-h-[4.75rem] items-center gap-4 rounded-[2.4rem] border bg-linear-to-b from-[#f4f5f8] to-[#f9fafb] py-2 pr-6 pl-2"
              >
                <Disc className="size-[3.75rem]">
                  <Icon className="size-6" strokeWidth={1.9} />
                </Disc>
                <span className="text-[1.0625rem] leading-snug font-medium">
                  {title}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <ButtonLink href={routes.startFree} size="lg">
              Start Free
            </ButtonLink>
            <ButtonLink href={routes.documentation} variant="quiet">
              <BookOpen className="size-5" aria-hidden="true" />
              View Documentation
            </ButtonLink>
          </div>
        </Reveal>

        <div
          role="img"
          aria-label="Example screen: a lead is ready for a rep, with the account owner, meeting time, and score shown."
          className="rounded-panel border-line relative isolate flex items-end justify-center overflow-hidden border bg-[#eaebee] px-5 pt-10 sm:px-12 lg:min-h-[40rem]"
        >
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#8a7cf5_0%,transparent_24%),linear-gradient(0deg,transparent_46%,transparent)] [mask-image:linear-gradient(180deg,transparent_14%,#000_34%,#000_52%,transparent_78%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#38c4df_0%,transparent_26%)] [mask-image:linear-gradient(180deg,transparent_42%,#000_74%)]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(270deg,#fba00b_0%,transparent_24%)] [mask-image:linear-gradient(180deg,transparent_56%,#000_92%)]" />
          <CornerDots />
          <ParallaxLayer className="w-full max-w-[29rem]" distance={-24}>
            <div className="-mb-8">
              <PhoneMockup screenClassName="bg-linear-to-b from-[#dfe1e5] via-white via-30% to-white lg:min-h-[37rem]">
                <NextActionScreen />
              </PhoneMockup>
            </div>
          </ParallaxLayer>
        </div>
      </div>
    </Section>
  );
}
