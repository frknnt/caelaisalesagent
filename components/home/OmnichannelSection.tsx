import { MessageCircle, Mail, MessagesSquare } from "lucide-react";

import { Section } from "@/components/layout/Section";
import { FloatingElement } from "@/components/motion/FloatingElement";
import { Reveal } from "@/components/motion/Reveal";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import {
  EmailScreen,
  UnifiedLeadScreen,
  WebChatScreen,
} from "@/components/product/ChannelScreens";
import { ButtonLink } from "@/components/ui/Button";
import { CornerDots } from "@/components/ui/CornerDots";
import { Disc } from "@/components/ui/Disc";
import { PhoneMockup } from "@/components/ui/PhoneMockup";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { channelBadges } from "@/data/home-content";
import { routes } from "@/data/navigation";
import { cn } from "@/lib/cn";

const tiles = [
  {
    id: "web",
    label: "Website chat where the agent introduces itself as an AI.",
    screen: <WebChatScreen />,
    screenClass: "bg-linear-to-b from-[#c9eff7] via-[#dbf5f9] to-[#eefbfd]",
    phoneClass: "lg:mt-[4.5rem]",
  },
  {
    id: "lead",
    label:
      "One lead’s timeline across website chat, email, and calendar, with a suggested next action.",
    screen: <UnifiedLeadScreen />,
    screenClass: "",
    phoneClass: "",
  },
  {
    id: "email",
    label: "Email follow-up with the CRM record it updated.",
    screen: <EmailScreen />,
    screenClass: "bg-linear-to-b from-[#f1f2f6] to-white",
    phoneClass: "lg:mt-[4.5rem]",
  },
];

export function OmnichannelSection() {
  return (
    <Section labelledBy="channels-heading">
      <Reveal>
        <SectionHeading
          id="channels-heading"
          eyebrow="Deploy Cael Everywhere"
          before="Engage Every"
          icon={MessagesSquare}
          after="Lead, on Every Channel"
          description="Deploy Cael across your website, messaging channels, email, and sales workflows without rebuilding your stack."
          wide
        />
        <ul
          aria-label="Channels"
          className="mx-auto mt-8 flex max-w-5xl flex-wrap justify-center gap-2.5"
        >
          {channelBadges.map(({ icon: Icon, title }) => (
            <li
              key={title}
              className="border-line bg-paper flex min-h-12 items-center gap-2.5 rounded-full border px-5 text-[0.9375rem] font-semibold"
            >
              <Icon className="text-cyan-ink size-5" aria-hidden="true" />
              {title}
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="relative mt-12 sm:mt-14">
        <StaggerGrid className="mx-auto grid max-w-[26rem] gap-4 lg:max-w-none lg:grid-cols-3 lg:gap-1.5">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              role="img"
              aria-label={tile.label}
              className="relative flex items-end justify-center overflow-hidden rounded-b-[1.75rem] px-4 pt-8 sm:px-8 lg:px-3 lg:pt-0 xl:px-8"
            >
              <span className="border-line absolute inset-x-0 top-0 bottom-0 rounded-[1.75rem] border bg-linear-to-b from-[#e0e2e7] to-[#f3f4f6] lg:top-32">
                <CornerDots />
              </span>
              <PhoneMockup
                className={cn("relative lg:min-h-[30rem]", tile.phoneClass)}
                screenClassName={cn("lg:min-h-[31rem]", tile.screenClass)}
              >
                {tile.screen}
              </PhoneMockup>
            </div>
          ))}
        </StaggerGrid>
        <div className="absolute bottom-24 left-1/3 hidden -translate-x-1/2 lg:block">
          <FloatingElement>
            <Disc>
              <MessageCircle className="text-cyan-ink size-6" />
            </Disc>
          </FloatingElement>
        </div>
        <div className="absolute top-60 left-2/3 hidden -translate-x-1/2 lg:block">
          <FloatingElement delay={0.35}>
            <Disc>
              <Mail className="text-violet size-6" />
            </Disc>
          </FloatingElement>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-body mb-5">
          Channel availability is listed on the integrations page.
        </p>
        <ButtonLink href={routes.startFree} size="lg">
          Deploy Your First Agent
        </ButtonLink>
      </div>
    </Section>
  );
}
