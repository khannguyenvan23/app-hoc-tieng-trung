import type { MetadataRoute } from "next";
import { seoPageList } from "@/lib/seo-pages";
import { absoluteSiteUrl } from "@/lib/site";

const lastModified = new Date("2026-07-04T00:00:00+07:00");

type PublicRoute = {
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
};

const publicRoutes: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  ...seoPageList.map((page) => ({
    path: page.path,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  })),
  { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: absoluteSiteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
