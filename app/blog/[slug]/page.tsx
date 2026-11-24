import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleBody } from "@/components/content/ArticleBody";
import { findArticle, posts } from "@/data/articles";
import { pageMetadata } from "@/lib/site/metadata";

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return posts.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = findArticle(posts, slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = findArticle(posts, slug);
  if (!post) notFound();

  return (
    <ArticleBody
      article={post}
      related={posts.filter((item) => item.slug !== slug)}
      basePath="/blog"
      backLabel="All articles"
    />
  );
}
