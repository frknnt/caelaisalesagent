import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/site/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app", "/auth/"],
    },
    sitemap: new URL("/sitemap.xml", getSiteOrigin()).toString(),
  };
}
