import { SeoContentPage } from "@/components/seo-content-page";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";
import { seoPages } from "@/lib/seo-pages";

const page = seoPages.dailyChinese;

export const metadata = buildSeoPageMetadata(page);

export default function DailyChinesePage() {
  return <SeoContentPage page={page} />;
}
