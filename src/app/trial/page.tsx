"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type TrialCard = {
  chinese: string;
  pinyin: string;
  meaningVi: string;
  exampleCn: string;
  examplePinyin: string;
  exampleVi: string;
};

const trialCards: TrialCard[] = [
  {
    chinese: "你好",
    pinyin: "ni hao",
    meaningVi: "Xin chào",
    exampleCn: "你好, 我是安。",
    examplePinyin: "Ni hao, wo shi An.",
    exampleVi: "Xin chào, tôi là An.",
  },
  {
    chinese: "谢谢",
    pinyin: "xie xie",
    meaningVi: "Cảm ơn",
    exampleCn: "谢谢你的帮助。",
    examplePinyin: "Xie xie ni de bang zhu.",
    exampleVi: "Cảm ơn sự giúp đỡ của bạn.",
  },
  {
    chinese: "学习",
    pinyin: "xue xi",
    meaningVi: "Học tập",
    exampleCn: "我每天学习中文。",
    examplePinyin: "Wo mei tian xue xi Zhong wen.",
    exampleVi: "Tôi học tiếng Trung mỗi ngày.",
  },
  {
    chinese: "工作",
    pinyin: "gong zuo",
    meaningVi: "Công việc / làm việc",
    exampleCn: "他在公司工作。",
    examplePinyin: "Ta zai gong si gong zuo.",
    exampleVi: "Anh ấy làm việc ở công ty.",
  },
  {
    chinese: "朋友",
    pinyin: "peng you",
    meaningVi: "Bạn bè",
    exampleCn: "她是我的朋友。",
    examplePinyin: "Ta shi wo de peng you.",
    exampleVi: "Cô ấy là bạn của tôi.",
  },
];

const ratingCopy = {
  again: "Học lại",
  hard: "Hơi khó",
  good: "Nhớ được",
  easy: "Quá dễ",
} as const;

type Rating = keyof typeof ratingCopy;

export default function TrialPage() {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [completed, setCompleted] = useState<Rating[]>([]);
  const card = trialCards[index];
  const progressPercent = useMemo(
    () => Math.round((completed.length / trialCards.length) * 100),
    [completed.length],
  );

  function rate(rating: Rating) {
    const nextCompleted = [...completed, rating];
    setCompleted(nextCompleted);
    setShowAnswer(false);

    if (index < trialCards.length - 1) {
      setIndex(index + 1);
    }
  }

  function restart() {
    setIndex(0);
    setShowAnswer(false);
    setCompleted([]);
  }

  const finished = completed.length >= trialCards.length;

  return (
    <main className="min-h-screen bg-stone-50 dark:bg-white/5 text-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link className="font-semibold" href="/">
            Tiếng Trung Hihi
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link className="rounded-md px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/10" href="/login">
              Đăng nhập
            </Link>
            <Link
              className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
              href="/login?next=/dashboard"
            >
              Lưu tiến độ
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:py-10">
        <div className="min-w-0">
          <div className="mb-5">
            <p className="text-sm font-medium uppercase text-teal-800 dark:text-teal-300">
              Học thử miễn phí
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Thử 5 thẻ HSK cơ bản trước khi đăng ký
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base">
              Làm một vòng flashcard ngắn để cảm nhận cách học: xem nghĩa tiếng
              Việt, đoán chữ Hán, bật pinyin khi cần, rồi tự đánh giá mức nhớ.
            </p>
          </div>

          <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/15">
            <div
              className="h-full rounded-full bg-teal-700 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {finished ? (
            <section className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm sm:p-7">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-300">
                Bạn đã hoàn thành bài học thử
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Tạo tài khoản để lưu tiến độ và học tiếp mỗi ngày
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Khi đăng ký, bạn có thể mở bộ HSK, lưu lịch ôn SRS, theo dõi
                streak và tiếp tục từ đúng chỗ vừa học.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  className="rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
                  href="/login?next=/dashboard"
                >
                  Tạo tài khoản miễn phí
                </Link>
                <button
                  className="rounded-md border border-zinc-300 dark:border-white/15 px-5 py-3 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-white/10"
                  onClick={restart}
                  type="button"
                >
                  Học thử lại
                </button>
              </div>
            </section>
          ) : (
            <section className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-4 shadow-sm sm:p-6">
              <div className="flex items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span>
                  Thẻ {index + 1} / {trialCards.length}
                </span>
                <button
                  aria-pressed={showPinyin}
                  className={`rounded-md border px-3 py-1.5 font-medium ${
                    showPinyin
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300"
                      : "border-zinc-300 dark:border-white/15 hover:bg-zinc-100 dark:hover:bg-white/10"
                  }`}
                  onClick={() => setShowPinyin(!showPinyin)}
                  type="button"
                >
                  Pinyin
                </button>
              </div>

              <div className="mt-8 text-center">
                <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Nghĩa tiếng Việt
                </div>
                <div className="mt-3 text-3xl font-semibold">
                  {card.meaningVi}
                </div>
              </div>

              {!showAnswer ? (
                <button
                  className="mt-10 min-h-12 w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
                  onClick={() => setShowAnswer(true)}
                  type="button"
                >
                  Hiện đáp án
                </button>
              ) : (
                <div className="mt-8">
                  <div className="rounded-lg bg-stone-50 dark:bg-white/5 p-4 text-center">
                    <div className="text-5xl font-semibold">{card.chinese}</div>
                    {showPinyin ? (
                      <div className="mt-3 text-lg text-teal-800 dark:text-teal-300">
                        {card.pinyin}
                      </div>
                    ) : null}
                    <div className="mt-5 border-t border-zinc-200 dark:border-white/10 pt-4">
                      <div className="text-sm font-medium uppercase text-zinc-500 dark:text-zinc-400">
                        Câu ví dụ
                      </div>
                      <div className="mt-2 text-xl font-medium">
                        {card.exampleCn}
                      </div>
                      {showPinyin ? (
                        <div className="mt-1 text-sm text-teal-800 dark:text-teal-300">
                          {card.examplePinyin}
                        </div>
                      ) : null}
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {card.exampleVi}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(ratingCopy) as Rating[]).map((rating) => (
                      <button
                        className="min-h-12 rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-white/10"
                        key={rating}
                        onClick={() => rate(rating)}
                        type="button"
                      >
                        {ratingCopy[rating]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-base font-semibold">Sau khi đăng ký</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <li>Lưu tiến độ từng thẻ và lịch ôn tiếp theo.</li>
            <li>Học bộ HSK1/HSK2 có sẵn hoặc tạo bộ riêng.</li>
            <li>Luyện câu, nghe chép chính tả và bật/tắt pinyin.</li>
          </ul>
          <Link
            className="mt-5 inline-flex w-full justify-center rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            href="/login?next=/dashboard"
          >
            Đăng ký để lưu
          </Link>
        </aside>
      </section>
    </main>
  );
}
