import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { buildSeoPageMetadata } from "@/lib/seo-metadata";
import { seoPages } from "@/lib/seo-pages";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";

const page = seoPages.dailyChinese;

export const metadata = buildSeoPageMetadata(page);

const dailyRoutine = [
  {
    icon: "calendar",
    time: "2 phút",
    title: "Xem lịch hôm nay",
    body: "App gom sẵn thẻ mới, thẻ đang học và thẻ đến hạn.",
  },
  {
    icon: "repeat",
    time: "5 phút",
    title: "Ôn phần sắp quên",
    body: "Chọn Quên, Khó, Nhớ hoặc Dễ để lên lịch lần sau.",
  },
  {
    icon: "audio",
    time: "5 phút",
    title: "Nghe và luyện câu",
    body: "Nghe audio tự nhiên hoặc chậm, bật pinyin khi cần.",
  },
  {
    icon: "edit",
    time: "3 phút",
    title: "Chép chính tả",
    body: "Nghe câu, gõ lại chữ Hán và kiểm tra từng từ.",
  },
] as const;

const learningModes = [
  {
    icon: "decks",
    title: "Nhớ chữ Hán bằng flashcard",
    body: "Mặt trước là nghĩa tiếng Việt. Bạn tự nhớ chữ Hán trước khi mở đáp án, pinyin và câu ví dụ.",
  },
  {
    icon: "sentences",
    title: "Hiểu từ trong câu thực tế",
    body: "Học trọn câu tiếng Trung, nghe audio và xem rõ từ mới đang được dùng trong ngữ cảnh nào.",
  },
  {
    icon: "edit",
    title: "Nghe rồi chép chính tả",
    body: "Ẩn câu tiếng Trung, nghe lại bằng phím tắt và nhận kết quả đúng, sai hoặc bỏ trống theo từng từ.",
  },
] as const;

const faqs = [
  {
    question: "Mỗi ngày nên học bao nhiêu từ tiếng Trung?",
    answer:
      "Người mới có thể bắt đầu với 10 từ và 10 câu mỗi ngày. Thẻ cũ đến hạn vẫn được ưu tiên ôn; bạn có thể đổi giới hạn trong Cài đặt khi đã quen nhịp.",
  },
  {
    question: "Tôi có cần nhìn pinyin liên tục không?",
    answer:
      "Không. Pinyin có chế độ bật hoặc tắt cho cả buổi học. Khi đã quen âm, bạn nên tắt pinyin và chỉ bật lại khi thực sự cần gợi ý.",
  },
  {
    question: "Học bộ thẻ có sẵn có tốn credit không?",
    answer:
      "Không. Credit chỉ dùng cho các tác vụ AI như tạo dữ liệu hoặc audio mới. Ôn flashcard, luyện câu và nghe lại audio đã có sẵn không trừ credit.",
  },
  {
    question: "Nếu nghỉ học vài ngày thì lịch SRS có mất không?",
    answer:
      "Không. Các thẻ đến hạn vẫn được giữ trong tài khoản. Khi quay lại, bạn chỉ cần xử lý phần tồn đọng rồi tiếp tục học từ mới.",
  },
] as const;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
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
      teaches: [
        "Từ vựng tiếng Trung",
        "Luyện nghe tiếng Trung",
        "Luyện câu tiếng Trung",
        "Chép chính tả tiếng Trung",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export default function DailyChinesePage() {
  return (
    <main className="bg-stone-50 text-zinc-950 dark:bg-[#101312] dark:text-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="relative isolate min-h-[580px] h-[86svh] max-h-[760px] overflow-hidden bg-zinc-950 text-white">
        <Image
          alt={page.heroImageAlt}
          className="absolute inset-0 -z-20 size-full object-cover object-top"
          fill
          preload
          sizes="100vw"
          src="/landing-study-sentences.png"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-zinc-950/80"
        />

        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5">
          <Link className="text-lg font-semibold" href="/">
            {siteConfig.name}
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            <Link
              className="hidden rounded-md px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white sm:inline-flex"
              href="/community"
            >
              Cộng đồng
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-white/85 hover:bg-white/10 hover:text-white"
              href="/pricing"
            >
              Bảng giá
            </Link>
            <Link
              className="rounded-md border border-white/30 bg-white/5 px-3 py-2 font-medium text-white hover:bg-white/15"
              href="/login"
            >
              Đăng nhập
            </Link>
          </nav>
        </header>

        <div className="mx-auto flex h-[calc(100%-74px)] max-w-6xl flex-col justify-center px-5 pb-16 pt-6">
          <p className="text-sm font-semibold text-teal-300">
            15 phút mỗi ngày · HSK1-HSK6 · học theo lịch SRS
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-6xl">
            Học tiếng Trung mỗi ngày
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-200">
            Mở app, ôn đúng phần sắp quên, nghe câu thực tế rồi kết thúc bằng
            vài phút chính tả. Một buổi học gọn, có lịch rõ ràng và không cần
            tự đoán hôm nay nên học gì.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-teal-600 px-6 py-3 font-semibold text-white shadow-lg hover:bg-teal-500"
              href="/trial"
            >
              <Icon name="play" size={18} />
              Học thử không cần đăng ký
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/35 bg-black/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
              href="/login"
            >
              Nhận 100 credit miễn phí
            </Link>
          </div>
          <p className="mt-4 text-sm text-zinc-300">
            Ôn bộ thẻ và nghe audio có sẵn không tốn credit.
          </p>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white py-14 dark:border-white/10 dark:bg-[#171a19]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              Một buổi học có điểm bắt đầu và kết thúc
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              15 phút đủ để tiến lên mỗi ngày
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Bạn không cần học hết mọi thứ trong một lần. Hệ thống tách buổi
              học thành bốn chặng ngắn để vừa nhớ từ, vừa nghe và dùng được
              trong câu.
            </p>
          </div>

          <ol className="mt-10 grid border-y border-zinc-200 dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {dailyRoutine.map((item, index) => (
              <li
                className="border-b border-zinc-200 px-0 py-6 dark:border-white/10 sm:px-5 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
                key={item.title}
              >
                <div className="flex items-center gap-3 text-teal-700 dark:text-teal-300">
                  <span className="flex size-9 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-500/15">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <span className="text-sm font-semibold">
                    {index + 1}. {item.time}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              SRS xếp lịch thay bạn
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Học đúng thẻ, đúng lúc
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Sau mỗi đáp án, bạn chỉ cần chọn đúng cảm giác nhớ của mình. Thẻ
              Quên và Khó quay lại sớm; thẻ Nhớ và Dễ được giãn lịch để bạn
              không ôn lặp vô ích.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                "Giới hạn riêng cho từ mới và câu mới mỗi ngày.",
                "Giữ hàng chờ khi bạn rời trang rồi quay lại.",
                "Nhóm thẻ yếu giúp tập trung vào lỗi lặp lại nhiều lần.",
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    <Icon name="check" size={15} />
                  </span>
                  <span className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              className="mt-8 inline-flex min-h-11 items-center rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              href="/trial"
            >
              Thử một lượt flashcard
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#171a19]">
            <Image
              alt="Flashcard tiếng Trung có audio, câu ví dụ và lịch ôn SRS"
              className="h-auto w-full"
              height={535}
              src="/landing-flashcard.png"
              width={979}
            />
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16 dark:border-white/10 dark:bg-[#171a19]">
        <div className="mx-auto max-w-6xl px-5">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Không chỉ học nghĩa rời rạc
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Ba cách để biến từ mới thành phản xạ
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {learningModes.map((mode) => (
              <article
                className="border-t-2 border-zinc-900 pt-5 dark:border-zinc-100"
                key={mode.title}
              >
                <span className="flex size-10 items-center justify-center rounded-md bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  <Icon name={mode.icon} size={20} />
                </span>
                <h3 className="mt-5 text-xl font-semibold">{mode.title}</h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {mode.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-12 overflow-hidden rounded-lg border border-zinc-200 bg-stone-50 shadow-xl dark:border-white/10 dark:bg-white/5">
            <Image
              alt="Màn hình luyện nghe chép chính tả tiếng Trung"
              className="h-auto w-full"
              height={767}
              src="/landing-dictation.png"
              width={1228}
            />
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              Chọn nội dung hợp mục tiêu
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Từ HSK đến tiếng Trung đi làm
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Bắt đầu với HSK1-HSK6 hoặc chọn bộ theo tình huống thật: giao tiếp
              hằng ngày, công sở, nhà máy, xây dựng, du lịch, logistics, bán
              hàng và sinh hoạt tại Trung Quốc.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
              {[
                "HSK1-HSK6",
                "Giao tiếp hằng ngày",
                "Công sở và phỏng vấn",
                "Nhà máy và xây dựng",
                "Du lịch và sân bay",
                "Logistics và bán hàng",
              ].map((item) => (
                <div
                  className="flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-white/10"
                  key={item}
                >
                  <Icon
                    className="shrink-0 text-rose-600 dark:text-rose-300"
                    name="check"
                    size={16}
                  />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#171a19] sm:p-8">
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              Ví dụ một ngày học
            </p>
            <div className="mt-6 space-y-5">
              {[
                { label: "Thẻ mới", value: "10", color: "bg-sky-500" },
                { label: "Đang học", value: "6", color: "bg-rose-500" },
                { label: "Đến hạn ôn", value: "14", color: "bg-emerald-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/10">
                    <div className={`h-full w-2/3 ${item.color}`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <Icon name="flame" size={22} />
                </span>
                <div>
                  <div className="font-semibold">Giữ chuỗi học mỗi ngày</div>
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Thống kê ngày, tháng và cấp độ HSK
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white py-16 dark:border-white/10 dark:bg-[#171a19]">
        <div className="mx-auto max-w-4xl px-5">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              Câu hỏi thường gặp
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Trước khi bắt đầu học
            </h2>
          </div>
          <div className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-white/10 dark:border-white/10">
            {faqs.map((item) => (
              <details className="group py-5" key={item.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="text-xl text-teal-700 group-open:rotate-45 dark:text-teal-300"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl pr-10 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 py-16 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-teal-300">
              Học thử ngay trên trình duyệt
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Bắt đầu một buổi học tiếng Trung hôm nay
            </h2>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              Không cần đăng ký để học thử. Khi tạo tài khoản, bạn nhận 100
              credit miễn phí để import từ riêng và tạo nội dung bằng AI.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-500"
              href="/trial"
            >
              <Icon name="play" size={18} />
              Học thử miễn phí
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
              href="/login"
            >
              Tạo tài khoản
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200 bg-white dark:border-white/10 dark:bg-[#171a19]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-zinc-950 dark:text-zinc-100">
              {siteConfig.name}
            </div>
            <div className="mt-1">Học đúng phần cần nhớ, mỗi ngày.</div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="hover:text-teal-700" href="/hsk1">
              HSK1
            </Link>
            <Link className="hover:text-teal-700" href="/hsk2">
              HSK2
            </Link>
            <Link className="hover:text-teal-700" href="/community">
              Cộng đồng
            </Link>
            <Link className="hover:text-teal-700" href="/pricing">
              Bảng giá
            </Link>
            <Link className="hover:text-teal-700" href="/privacy">
              Chính sách bảo mật
            </Link>
            <Link className="hover:text-teal-700" href="/terms">
              Điều khoản
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
