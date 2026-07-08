import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPublicEnv } from "@/lib/env";
import { seoPageList } from "@/lib/seo-pages";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `${siteConfig.name} - Học từ vựng tiếng Trung với SRS và audio`,
  description: siteConfig.description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${siteConfig.name} - Học từ vựng tiếng Trung với SRS và audio`,
    description: siteConfig.description,
    url: absoluteSiteUrl("/"),
    type: "website",
  },
};

const landingJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: siteConfig.url,
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.url}/#website`,
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      inLanguage: "vi-VN",
      publisher: {
        "@id": `${siteConfig.url}/#organization`,
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteConfig.url}/#app`,
      name: siteConfig.name,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteConfig.url,
      description: siteConfig.description,
      inLanguage: "vi-VN",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "VND",
      },
      featureList: [
        "Flashcard từ vựng HSK",
        "Audio tiếng Trung",
        "Lặp lại ngắt quãng SRS",
        "Luyện câu tiếng Trung",
        "Luyện nghe chép chính tả tiếng Trung",
        "Ẩn hiện pinyin",
      ],
    },
  ],
};

const features = [
  {
    title: "Bộ HSK sẵn sàng",
    body: "Bắt đầu nhanh với HSK1 đến HSK5 và các bộ chủ đề. Mỗi tài khoản có tiến độ riêng.",
  },
  {
    title: "Audio tiếng Trung",
    body: "Nghe phát âm từ vựng và câu ví dụ, có chế độ chậm để nghe rõ từng âm.",
  },
  {
    title: "SRS chống quên",
    body: "Quên, Khó, Nhớ, Dễ tự tính lịch ôn tiếp theo để học ít hơn mà nhớ lâu hơn.",
  },
  {
    title: "Luyện câu thực tế",
    body: "Học từ trong câu, xem nghĩa tiếng Việt, pinyin khi cần và luyện viết chữ Hán.",
  },
  {
    title: "Nghe chép chính tả",
    body: "Ẩn câu, nghe audio rồi chép lại tiếng Trung. Bật nghĩa Việt khi cần và kiểm tra ngay.",
  },
];

const steps = [
  "Chọn bộ HSK hoặc tạo bộ thẻ riêng.",
  "Import từ vựng, app tự tạo nghĩa, pinyin, câu ví dụ và audio.",
  "Ôn mỗi ngày bằng flashcard, luyện câu, chép chính tả và lịch SRS.",
];

async function redirectAuthenticatedUser() {
  if (!hasPublicEnv()) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }
}

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const code = getFirstSearchParam(query.code);

  // Auth links fall back to Site URL when their redirect URL is not allow-listed.
  // A bare code cannot identify the flow, so treat it as account confirmation.
  if (code) {
    const callbackParams = new URLSearchParams({
      code,
      next: "/dashboard",
    });
    redirect(`/auth/callback?${callbackParams.toString()}`);
  }

  const tokenHash = getFirstSearchParam(query.token_hash);
  const type = getFirstSearchParam(query.type);

  if (tokenHash && type === "recovery") {
    const recoveryParams = new URLSearchParams({ token_hash: tokenHash, type });
    redirect(`/reset-password?${recoveryParams.toString()}`);
  }

  await redirectAuthenticatedUser();

  return (
    <main className="bg-stone-50 text-zinc-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(landingJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <section className="relative isolate min-h-[78svh] overflow-hidden bg-zinc-950 text-white">
        <Image
          alt="Màn hình luyện câu Tiếng Trung Hihi"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-left-top opacity-55"
          height={815}
          priority
          src="/landing-study-sentences.png"
          width={1308}
        />
        <div className="absolute inset-0 -z-10 bg-zinc-950/65" />

        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="text-lg font-semibold">Tiếng Trung Hihi</div>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white"
              href="/pricing"
            >
              Bảng giá
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white"
              href="/login"
            >
              Đăng nhập
            </Link>
            <Link
              className="rounded-md bg-white px-4 py-2 font-medium text-zinc-950 hover:bg-stone-100"
              href="/trial"
            >
              Bắt đầu
            </Link>
          </nav>
        </header>

        <div className="mx-auto flex max-w-6xl px-5 pb-16 pt-16 sm:pb-20 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-teal-200">
              Flashcard tiếng Trung cho người tự học
            </p>
            <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-tight sm:text-6xl">
              Tiếng Trung Hihi
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-100 sm:text-xl">
              Học từ vựng HSK bằng flashcard, audio, câu ví dụ, luyện chép
              chính tả và thuật toán lặp lại ngắt quãng. Mỗi ngày chỉ cần mở
              app và ôn đúng phần đến hạn.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                className="rounded-md bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500"
                href="/trial"
              >
                Bắt đầu học miễn phí
              </Link>
              <a
                className="rounded-md border border-white/35 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                href="#features"
              >
                Xem tính năng
              </a>
              <Link
                className="rounded-md border border-white/35 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                href="/pricing"
              >
                Xem bảng giá
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-sm text-stone-100">
              <span className="rounded-md bg-white/12 px-3 py-2">HSK1-HSK5</span>
              <span className="rounded-md bg-white/12 px-3 py-2">Audio</span>
              <span className="rounded-md bg-white/12 px-3 py-2">SRS</span>
              <span className="rounded-md bg-white/12 px-3 py-2">Luyện câu</span>
              <span className="rounded-md bg-white/12 px-3 py-2">Chính tả</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b border-zinc-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold">Học từ mới, nhớ đúng lúc</h2>
            <p className="mt-3 text-base leading-7 text-zinc-600">
              App tập trung vào việc học thật: nhập từ nhanh, nghe phát âm, ôn
              theo lịch và luyện lại các thẻ dễ quên.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {features.map((feature) => (
              <article
                className="rounded-lg border border-zinc-200 bg-stone-50 p-5"
                key={feature.title}
              >
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold">Một nơi cho cả từ vựng và câu</h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Mặt trước có thể là nghĩa tiếng Việt để tự nhớ chữ Hán. Mặt sau
              có chữ Trung, pinyin khi bật, nghĩa, câu ví dụ và audio.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              {steps.map((step) => (
                <li className="flex gap-3" key={step}>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <Image
              alt="Màn hình ôn tập flashcard Tiếng Trung Hihi"
              className="h-auto w-full"
              height={535}
              src="/landing-flashcard.png"
              width={979}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-14">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
              Luyện nghe chủ động
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Nghe rồi chép, nhớ câu sâu hơn
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600">
              Chế độ chính tả ẩn câu tiếng Trung để bạn nghe audio và tự chép
              lại. Khi bí, có thể bật nghĩa tiếng Việt mà chưa cần xem đáp án.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-zinc-700">
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                <span>Tự phát audio khi chuyển sang câu mới.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                <span>Bật hoặc tắt nghĩa tiếng Việt theo mức độ cần gợi ý.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                <span>Kiểm tra đúng sai ngay, dùng Ctrl để nghe lại và Space để xem đáp án.</span>
              </li>
            </ul>
            <Link
              className="mt-7 inline-flex rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
              href="/trial"
            >
              Bắt đầu luyện chính tả
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-stone-50 shadow-sm">
            <Image
              alt="Chế độ luyện nghe chép chính tả tiếng Trung"
              className="h-auto w-full"
              height={767}
              src="/landing-dictation.png"
              width={1228}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="text-4xl font-semibold text-teal-700">2.500+</div>
              <p className="mt-2 text-sm text-zinc-600">
                Từ vựng HSK1-HSK5 có sẵn để bắt đầu ngay.
              </p>
            </div>
            <div>
              <div className="text-4xl font-semibold text-teal-700">SRS</div>
              <p className="mt-2 text-sm text-zinc-600">
                Tự lên lịch ôn theo mức Quên, Khó, Nhớ, Dễ.
              </p>
            </div>
            <div>
              <div className="text-4xl font-semibold text-teal-700">AI</div>
              <p className="mt-2 text-sm text-zinc-600">
                Tự tạo nghĩa, pinyin, câu ví dụ và audio khi import từ.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="text-3xl font-semibold">Bắt đầu học tiếng Trung hôm nay</h2>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            Tạo tài khoản miễn phí, thêm bộ HSK hoặc import từ riêng của bạn,
            rồi để app nhắc đúng thẻ cần ôn mỗi ngày.
          </p>
          <Link
            className="mt-7 inline-flex rounded-md bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            href="/trial"
          >
            Bắt đầu học miễn phí
          </Link>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-zinc-600">
          <div>© 2026 Tiếng Trung Hihi</div>
          <nav className="flex flex-wrap gap-4">
            {seoPageList.map((page) => (
              <Link
                className="hover:text-teal-800 hover:underline"
                href={page.path}
                key={page.path}
              >
                {page.navLabel}
              </Link>
            ))}
            <Link className="hover:text-teal-800 hover:underline" href="/privacy">
              Chính sách bảo mật
            </Link>
            <Link className="hover:text-teal-800 hover:underline" href="/terms">
              Điều khoản sử dụng
            </Link>
            <Link className="hover:text-teal-800 hover:underline" href="/pricing">
              Bảng giá credit
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
