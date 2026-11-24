import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/content/ArticleBody";
import { findArticle, guides } from "@/data/articles";
import { pageMetadata } from "@/lib/site/metadata";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = findArticle(guides, slug);
  if (!guide) return {};
  return pageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/resources/${guide.slug}`,
  });
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = findArticle(guides, slug);
  if (!guide) notFound();

  return (
    <ArticleBody
      article={guide}
      related={guides.filter((item) => item.slug !== slug)}
      basePath="/resources"
      backLabel="All resources"
    />
  );
}
