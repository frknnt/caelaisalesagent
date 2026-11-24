import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Article } from "@/types/content";

interface ArticleCardProps {
  article: Article;
  basePath: "/blog" | "/resources";
  headingLevel?: 2 | 3;
}

export function ArticleCard({
  article,
  basePath,
  headingLevel = 3,
}: ArticleCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Card as="article" className="group flex flex-col p-7 sm:p-9">
      <div className="flex items-center justify-between gap-3">
        <Badge>{article.category}</Badge>
        <span className="text-body text-sm">{article.readingTime}</span>
      </div>
      <Heading className="mt-8 text-2xl leading-tight font-medium">
        <Link
          href={`${basePath}/${article.slug}`}
          className="after:rounded-card rounded-lg after:absolute after:inset-0"
        >
          {article.title}
        </Link>
      </Heading>
      <p className="text-body mt-3">{article.description}</p>
      <span
        aria-hidden="true"
        className="disc-surface mt-auto inline-flex size-12 translate-y-2 items-center justify-center self-end rounded-full"
      >
        <ArrowUpRight className="size-5 transition-[translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Card>
  );
}
