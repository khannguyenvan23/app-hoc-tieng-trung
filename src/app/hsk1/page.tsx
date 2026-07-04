import { SeoContentPage } from "@/components/seo-content-page";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";
import { seoPages } from "@/lib/seo-pages";

const page = seoPages.hsk1;

export const metadata = buildSeoPageMetadata(page);

export default function Hsk1Page() {
  return <SeoContentPage page={page} />;
}
