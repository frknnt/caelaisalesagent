import type { MetadataRoute } from "next";

import { guides, posts } from "@/data/articles";
import { getSiteOrigin } from "@/lib/site/config";

const paths = [
  "/",
  "/features",
  "/pricing",
  "/integrations",
  "/resources",
  "/resources/documentation",
  "/blog",
  "/customer-stories",
  "/support",
  "/security",
  "/about",
  "/careers",
  "/contact",
  "/privacy",
  "/start-free",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  return [
    ...paths,
    ...guides.map((guide) => `/resources/${guide.slug}`),
    ...posts.map((post) => `/blog/${post.slug}`),
  ].map((path) => ({ url: new URL(path, origin).toString() }));
}
