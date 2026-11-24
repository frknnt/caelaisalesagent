import type { Metadata } from "next";

import { siteConfig } from "./config";

// A page-level openGraph block replaces the inherited one, image included.
const socialImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Cael AI Sales Agent. Turn Every Conversation Into Revenue.",
};

interface PageMetadataInput {
  title: string;
  description: string;
  path: `/${string}`;
  /** Use the title exactly as written instead of appending the brand. */
  absoluteTitle?: boolean;
  noIndex?: boolean;
}

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  noIndex = false,
}: PageMetadataInput): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | ${siteConfig.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title: socialTitle,
      description,
      url: path,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
