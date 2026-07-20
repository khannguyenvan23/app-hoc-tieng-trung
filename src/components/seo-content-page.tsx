import Image from "next/image";
import Link from "next/link";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";
import { seoPageList, type SeoPageContent } from "@/lib/seo-pages";

function createJsonLd(page: SeoPageContent) {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: page.title,
    headline: page.title,
    description: page.description,
    url: absoluteSiteUrl(page.path),
    inLanguage: "vi-VN",
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    about: page.keywords,
    teaches: page.highlights,
  };
}

export function SeoContentPage({ page }: { page: SeoPageContent }) {
  const jsonLd = createJsonLd(page);

  return (
    <main className="bg-stone-50 dark:bg-white/5 text-zinc-950 dark:text-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <header className="border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link className="text-lg font-semibold" href="/">
            {siteConfig.name}
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-stone-100 hover:text-teal-800"
              href="/hsk1"
            >
              HSK1
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-stone-100 hover:text-teal-800"
              href="/hsk2"
            >
              HSK2
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-stone-100 hover:text-teal-800"
              href="/pricing"
            >
              Bảng giá
            </Link>
            <Link
              className="rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 font-medium hover:bg-stone-100"
              href="/login"
            >
              Đăng nhập
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-16">
          <p className="text-sm font-semibold uppercase text-teal-700 dark:text-teal-300">
            {page.eyebrow}
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {page.description}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className="rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
              href="/login"
            >
              Bắt đầu học miễn phí
            </Link>
            <Link
              className="rounded-md border border-zinc-300 dark:border-white/15 px-5 py-3 text-sm font-semibold hover:bg-stone-100"
              href="/pricing"
            >
              Xem bảng giá
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            {page.highlights.slice(0, 4).map((highlight) => (
              <span
                className="rounded-md border border-teal-100 dark:border-teal-500/30 bg-teal-50 dark:bg-teal-500/15 px-3 py-2 text-teal-900 dark:text-teal-200"
                key={highlight}
              >
                {highlight}
              </span>
            ))}
          </div>

          <div className="mt-10 overflow-hidden rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
            <Image
              alt={page.heroImageAlt}
              className="h-auto w-full"
              height={page.heroImage.includes("sentences") ? 815 : 535}
              priority
              src={page.heroImage}
              width={page.heroImage.includes("sentences") ? 1308 : 979}
            />
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-5xl px-5">
          <div className="grid gap-4 md:grid-cols-3">
            {page.sections.map((section) => (
              <article
                className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-sm"
                key={section.title}
              >
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 px-5 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-semibold">{page.stepsTitle}</h2>
            <p className="mt-3 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Giữ nhịp học nhỏ, đều và đo đúng mức nhớ của mình sau mỗi lần mở
              đáp án.
            </p>
          </div>
          <ol className="space-y-3">
            {page.steps.map((step, index) => (
              <li
                className="flex gap-4 rounded-lg border border-zinc-200 dark:border-white/10 bg-stone-50 dark:bg-white/5 p-4"
                key={step}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal-700 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span className="pt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-3xl font-semibold">Câu hỏi thường gặp</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {page.faq.map((item) => (
              <article
                className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-sm"
                key={item.question}
              >
                <h3 className="font-semibold">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 py-12">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-2xl font-semibold">Chủ đề liên quan</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {page.related.map((link) => (
              <Link
                className="rounded-md border border-zinc-300 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-stone-100 hover:text-teal-800"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-3xl font-semibold">
            Học tiếng Trung gọn hơn, đều hơn
          </h2>
          <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Tạo tài khoản miễn phí, thêm bộ HSK hoặc import từ vựng riêng, rồi
            để {siteConfig.name} nhắc đúng phần cần ôn mỗi ngày.
          </p>
          <Link
            className="mt-7 inline-flex rounded-md bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            href="/login"
          >
            Bắt đầu học miễn phí
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-zinc-600 dark:text-zinc-400">
          <div>© 2026 {siteConfig.name}</div>
          <nav className="flex flex-wrap gap-4">
            {seoPageList.map((link) => (
              <Link
                className="hover:text-teal-800 hover:underline"
                href={link.path}
                key={link.path}
              >
                {link.navLabel}
              </Link>
            ))}
            <Link className="hover:text-teal-800 hover:underline" href="/privacy">
              Chính sách bảo mật
            </Link>
            <Link className="hover:text-teal-800 hover:underline" href="/terms">
              Điều khoản
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
