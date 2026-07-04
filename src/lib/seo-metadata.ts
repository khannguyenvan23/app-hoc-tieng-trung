import type { Metadata } from "next";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";
import type { SeoPageContent } from "@/lib/seo-pages";

export function buildSeoPageMetadata(page: SeoPageContent): Metadata {
  return {
    title: `${page.metaTitle} | ${siteConfig.name}`,
    description: page.description,
    keywords: [...page.keywords],
    alternates: {
      canonical: page.path,
    },
    openGraph: {
      title: `${page.metaTitle} | ${siteConfig.name}`,
      description: page.description,
      url: absoluteSiteUrl(page.path),
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${page.metaTitle} | ${siteConfig.name}`,
      description: page.description,
    },
  };
}
