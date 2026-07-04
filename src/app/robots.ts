import type { MetadataRoute } from "next";
import { seoPageList } from "@/lib/seo-pages";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        ...seoPageList.map((page) => page.path),
        "/pricing",
        "/privacy",
        "/terms",
      ],
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/decks/",
        "/login",
        "/options",
        "/reset-password",
        "/study",
        "/study-sentences",
      ],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: siteConfig.url,
  };
}
