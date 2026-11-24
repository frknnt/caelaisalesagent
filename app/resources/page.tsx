import { ArrowUpRight, BookOpen, Newspaper, Users } from "lucide-react";
import Link from "next/link";

import { ArticleCard } from "@/components/content/ArticleCard";
import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { Disc } from "@/components/ui/Disc";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { guides } from "@/data/articles";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Resources",
  description:
    "Guides and documentation for launching, qualifying, handing off, and handling consent with Cael.",
  path: "/resources",
});

const destinations = [
  {
    href: "/blog",
    icon: Newspaper,
    title: "Blog",
    description: "Short reads on sales conversations, guardrails, and handoff.",
  },
  {
    href: "/customer-stories",
    icon: Users,
    title: "Customer stories",
    description: "How we publish them, plus worked example scenarios.",
  },
];

export default function ResourcesPage() {
  return (
    <>
      <PageHero
        before="Everything You Need to"
        icon={BookOpen}
        after="Launch Well"
        description="Practical guides for teams putting an AI agent in front of real customers."
      />

      <PageContainer className="pb-6">
        <div className="grid gap-2.5 lg:grid-cols-[1.5fr_1fr]">
          <Link
            href="/resources/documentation"
            className="card-lift rounded-panel border-line group relative isolate flex min-h-72 flex-col justify-between overflow-hidden border bg-[#eceef1] p-8 sm:p-12"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-[radial-gradient(45%_90%_at_100%_100%,rgb(251_160_11/0.5),transparent),radial-gradient(40%_70%_at_100%_0%,rgb(51_195_222/0.45),transparent)]"
            />
            <Disc size="lg">
              <BookOpen className="size-8" strokeWidth={1.8} />
            </Disc>
            <span>
              <span className="font-display display-md block">
                Documentation
              </span>
              <span className="mt-2 block max-w-md text-[1.0625rem] text-[#3f454f]">
                Core concepts, roles, invitations, handoff, and what is
                available today.
              </span>
            </span>
          </Link>
          <div className="grid gap-2.5">
            {destinations.map(({ href, icon: Icon, title, description }) => (
              <Link
                key={href}
                href={href}
                className="card-lift rounded-panel border-line bg-mist group flex items-start gap-5 border p-7 sm:p-8"
              >
                <Disc>
                  <Icon className="size-6" strokeWidth={1.9} />
                </Disc>
                <span className="flex-1">
                  <span className="font-display block text-xl font-medium">
                    {title}
                  </span>
                  <span className="text-body mt-1 block">{description}</span>
                </span>
                <ArrowUpRight
                  className="size-5 text-[#7b828d]"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      </PageContainer>

      <Section labelledBy="guides-heading">
        <Panel>
          <PanelHeader
            id="guides-heading"
            title="Guides"
            description="Read them in order, or start where you are stuck."
          />
          <StaggerGrid className="grid gap-1.5 sm:gap-2 md:grid-cols-2">
            {guides.map((guide) => (
              <div key={guide.slug} className="grid">
                <ArticleCard article={guide} basePath="/resources" />
              </div>
            ))}
          </StaggerGrid>
        </Panel>
      </Section>

      <FinalCta
        title="Read Enough? Build One."
        description="Choose a mode, add a few approved pages, and test it with your own questions."
      />
    </>
  );
}
