import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import type { Article } from "@/types/content";

import { ArticleCard } from "./ArticleCard";

interface ArticleBodyProps {
  article: Article;
  related: Article[];
  basePath: "/blog" | "/resources";
  backLabel: string;
}

export function ArticleBody({
  article,
  related,
  basePath,
  backLabel,
}: ArticleBodyProps) {
  return (
    <>
      <article className="pt-8 pb-14 sm:pt-12 sm:pb-20">
        <PageContainer width="text">
          <Link
            href={basePath}
            className="text-body hover:text-ink inline-flex min-h-11 items-center gap-2 font-medium"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {backLabel}
          </Link>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Badge tone="cyan">{article.category}</Badge>
            <span className="text-body text-[0.9375rem]">
              {article.readingTime}
            </span>
          </div>
          <h1 className="display-lg mt-5 font-normal">{article.title}</h1>
          <p className="mt-6 text-xl leading-relaxed text-[#3b404a]">
            {article.intro}
          </p>
          <div className="prose-cael">
            {article.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.list ? (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </PageContainer>
      </article>
      <section aria-labelledby="related-heading" className="pb-10">
        <PageContainer>
          <Panel>
            <h2
              id="related-heading"
              className="display-md px-5 pt-9 pb-8 font-normal sm:px-9"
            >
              Keep reading
            </h2>
            <div className="grid gap-1.5 sm:gap-2 md:grid-cols-3">
              {related.map((item) => (
                <ArticleCard
                  key={item.slug}
                  article={item}
                  basePath={basePath}
                />
              ))}
            </div>
          </Panel>
        </PageContainer>
      </section>
    </>
  );
}
