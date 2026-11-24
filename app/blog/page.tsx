import { ArrowUpRight, Newspaper } from "lucide-react";
import Link from "next/link";

import { ArticleCard } from "@/components/content/ArticleCard";
import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { MessageBubble } from "@/components/product/MessageBubble";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { posts } from "@/data/articles";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Blog",
  description:
    "Short, practical writing about sales conversations, guardrails, follow-up, and handoff.",
  path: "/blog",
});

export default function BlogPage() {
  const [lead, ...rest] = posts;

  return (
    <>
      <PageHero
        before="Notes on Better"
        icon={Newspaper}
        after="Sales Conversations"
        description="What to automate, what to leave to people, and how to tell the difference."
      />
      <PageContainer className="pb-10">
        {lead ? (
          <article className="card-lift rounded-panel border-line group relative grid overflow-hidden border lg:grid-cols-2">
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="cyan">{lead.category}</Badge>
                <span className="text-body text-sm">{lead.readingTime}</span>
              </div>
              <h2 className="display-md mt-5 font-normal">
                <Link
                  href={`/blog/${lead.slug}`}
                  className="after:rounded-panel rounded-lg after:absolute after:inset-0"
                >
                  {lead.title}
                </Link>
              </h2>
              <p className="text-body mt-4 text-[1.0625rem]">
                {lead.description}
              </p>
              <span
                aria-hidden="true"
                className="mt-6 inline-flex items-center gap-2 font-semibold"
              >
                Read the article
                <ArrowUpRight className="size-5 transition-[translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
            <div
              aria-hidden="true"
              className="relative flex min-h-72 flex-col justify-center gap-3 bg-[radial-gradient(60%_80%_at_100%_100%,rgb(251_160_11/0.45),transparent),radial-gradient(50%_70%_at_0%_100%,rgb(51_195_222/0.5),transparent)] bg-[#eceef1] p-8 sm:p-14"
            >
              <MessageBubble from="visitor">
                Will this create extra work for us?
              </MessageBubble>
              <MessageBubble
                from="agent"
                source="Rollout guide"
                className="[&>div]:bg-paper [&_span]:bg-mist"
              >
                Setup starts with one page. Here is what your team does first.
              </MessageBubble>
            </div>
          </article>
        ) : null}

        <Panel className="mt-3">
          <h2 className="display-md px-5 pt-9 pb-8 font-normal sm:px-9">
            More articles
          </h2>
          <StaggerGrid className="grid gap-1.5 sm:gap-2 md:grid-cols-3">
            {rest.map((post) => (
              <div key={post.slug} className="grid">
                <ArticleCard article={post} basePath="/blog" />
              </div>
            ))}
          </StaggerGrid>
        </Panel>
      </PageContainer>
      <FinalCta />
    </>
  );
}
