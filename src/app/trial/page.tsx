"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { RatingButtons } from "@/components/rating-buttons";
import { defaultStudySettings } from "@/lib/study-settings";
import type { ReviewRating } from "@/lib/types";

// A fresh-card state so RatingButtons shows the same real SRS interval previews
// the app does ("Lặp lại sau 10 phút", "1 ngày"…) — the trial demos the actual
// scheduler, not a stand-in.
const trialReviewState = {
  review_count: 0,
  interval_days: 0,
  ease_factor: null,
  learning_step: 0,
};

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

export default function TrialPage() {
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [completed, setCompleted] = useState<ReviewRating[]>([]);
  const card = trialCards[index];
  const progressPercent = useMemo(
    () => Math.round((completed.length / trialCards.length) * 100),
    [completed.length],
  );

  function rate(rating: ReviewRating) {
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
            <section className="study-card overflow-hidden p-6 text-center sm:p-8">
              <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                <Icon name="trophy" size={28} />
              </span>
              <h2 className="mt-4 text-2xl font-semibold">
                Bạn vừa học {trialCards.length} từ tiếng Trung đầu tiên
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Đăng ký miễn phí để lưu tiến độ, mở khoá hàng nghìn từ HSK, và để
                thuật toán SRS tự nhắc bạn ôn đúng lúc — tiếp tục ngay từ chỗ vừa
                dừng.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  className="btn-primary px-6 py-2.5 text-sm"
                  href="/login?next=/dashboard"
                >
                  Đăng ký miễn phí
                </Link>
                <button
                  className="btn-secondary px-6 py-2.5 text-sm"
                  onClick={restart}
                  type="button"
                >
                  Học thử lại
                </button>
              </div>
            </section>
          ) : (
            <section
              className="study-card min-w-0 overflow-hidden p-4 sm:p-5"
              key={index}
            >
              <div className="flex items-center justify-between gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span>
                  Thẻ {index + 1} / {trialCards.length}
                </span>
                <button
                  aria-pressed={showPinyin}
                  className={`rounded-md border px-3 py-1.5 font-medium ${ showPinyin ? "border-teal-700 bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300" : "border-zinc-300 dark:border-white/15 hover:bg-zinc-100 dark:hover:bg-white/10" }`}
                  onClick={() => setShowPinyin(!showPinyin)}
                  type="button"
                >
                  Pinyin
                </button>
              </div>

              <div className="mt-6 text-center">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Nghĩa tiếng Việt
                </div>
                <div className="mt-2 text-2xl font-semibold sm:text-3xl">
                  {card.meaningVi}
                </div>
              </div>

              {!showAnswer ? (
                <button
                  className="btn-primary mt-6 w-full px-4 py-2.5 text-sm"
                  onClick={() => setShowAnswer(true)}
                  type="button"
                >
                  Hiện đáp án
                </button>
              ) : (
                <>
                  <div className="study-answer-panel mt-4 p-4 text-center sm:p-5">
                    <div className="text-4xl font-semibold leading-relaxed sm:text-5xl">
                      {card.chinese}
                    </div>
                    {showPinyin ? (
                      <div className="mt-2 text-lg text-teal-800 dark:text-teal-300">
                        {card.pinyin}
                      </div>
                    ) : null}
                    <div className="mt-4 border-t border-zinc-200/70 pt-4 dark:border-white/10">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Câu ví dụ
                      </div>
                      <div className="mt-2 text-xl font-medium">
                        {card.exampleCn}
                      </div>
                      {showPinyin ? (
                        <div className="mt-0.5 text-sm text-teal-800 dark:text-teal-300">
                          {card.examplePinyin}
                        </div>
                      ) : null}
                      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {card.exampleVi}
                      </div>
                    </div>
                  </div>

                  <RatingButtons
                    onRate={rate}
                    review={trialReviewState}
                    settings={defaultStudySettings}
                  />
                </>
              )}
            </section>
          )}
        </div>

        <aside className="rounded-[var(--radius-lg)] border border-zinc-200 bg-white p-5 shadow-[var(--shadow-md)] dark:border-white/10 dark:bg-[#171a19] lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-base font-semibold">Sau khi đăng ký</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {[
              "Lưu tiến độ từng thẻ và lịch ôn tiếp theo.",
              "Học bộ HSK1/HSK2 có sẵn hoặc tạo bộ riêng.",
              "Luyện câu, nghe chép chính tả và bật/tắt pinyin.",
            ].map((item) => (
              <li className="flex gap-2.5" key={item}>
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                  <Icon name="check" size={13} />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link
            className="btn-primary mt-5 flex w-full justify-center px-4 py-2.5 text-sm"
            href="/login?next=/dashboard"
          >
            Đăng ký để lưu
          </Link>
        </aside>
      </section>
    </main>
  );
}
