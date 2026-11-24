import {
  BookOpen,
  KeyRound,
  LifeBuoy,
  MessageCircle,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { Accordion } from "@/components/ui/Accordion";
import { ButtonLink } from "@/components/ui/Button";
import { Disc } from "@/components/ui/Disc";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { supportFaq } from "@/data/faq";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Support",
  description:
    "Find answers about setup, handoff, invitations, and sign-in, or contact the Cael team.",
  path: "/support",
});

const topics = [
  {
    href: "/resources/launch-your-first-agent",
    icon: BookOpen,
    title: "Set up an agent",
    description: "From an empty workspace to a tested first agent.",
  },
  {
    href: "/resources/design-a-human-handoff",
    icon: MessageCircle,
    title: "Handle handoffs",
    description: "Triggers, summaries, and what the visitor is told.",
  },
  {
    href: "/resources/documentation",
    icon: Users,
    title: "Manage your team",
    description: "Roles, permissions, and invitations.",
  },
  {
    href: "/security",
    icon: KeyRound,
    title: "Access and data",
    description: "Who can see what, and how data stays separate.",
  },
];

export default function SupportPage() {
  return (
    <>
      <PageHero
        before="How Can We"
        icon={LifeBuoy}
        after="Help?"
        description="Start with a topic or a common question. If neither helps, write to us."
      />
      <section aria-labelledby="topics-heading" className="pb-6">
        <PageContainer>
          <h2 id="topics-heading" className="sr-only">
            Help topics
          </h2>
          <StaggerGrid className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {topics.map(({ href, icon: Icon, title, description }) => (
              <div key={href} className="grid">
                <Link
                  href={href}
                  className="card-lift rounded-card border-line border bg-linear-to-b from-[#f4f5f8] to-white p-7"
                >
                  <Disc>
                    <Icon className="size-6" strokeWidth={1.9} />
                  </Disc>
                  <span className="font-display mt-6 block text-xl font-medium">
                    {title}
                  </span>
                  <span className="text-body mt-1.5 block">{description}</span>
                </Link>
              </div>
            ))}
          </StaggerGrid>
        </PageContainer>
      </section>

      <Section width="faq" labelledBy="support-faq-heading">
        <SectionHeading id="support-faq-heading" before="Common questions" />
        <div className="mt-8">
          <Accordion items={supportFaq} defaultOpen="first-agent" />
        </div>
        <p className="text-body mt-5 text-center text-[0.9375rem]">
          Cael is in early access. Check the{" "}
          <Link
            href="/resources/documentation"
            className="text-ink font-medium underline underline-offset-2"
          >
            documentation
          </Link>{" "}
          for what is available today.
        </p>
      </Section>

      <Section labelledBy="support-contact-heading">
        <div className="rounded-panel border-line bg-mist flex flex-col gap-6 border p-7 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="support-contact-heading" className="display-md font-normal">
              Still stuck?
            </h2>
            <p className="text-body mt-3 max-w-2xl">
              Send us what you were trying to do and what happened instead.
              Please leave passwords and customer data out of your message.
            </p>
          </div>
          <ButtonLink href="/contact?topic=support" size="lg">
            Contact Support
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
