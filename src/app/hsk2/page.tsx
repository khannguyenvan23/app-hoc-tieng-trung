import { SeoContentPage } from "@/components/seo-content-page";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";
import { seoPages } from "@/lib/seo-pages";

const page = seoPages.hsk2;

export const metadata = buildSeoPageMetadata(page);

export default function Hsk2Page() {
  return <SeoContentPage page={page} />;
}
