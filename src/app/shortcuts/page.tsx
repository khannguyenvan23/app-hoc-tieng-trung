import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";

type Shortcut = {
  keys: string[];
  action: string;
  note?: string;
};

const sharedShortcuts: Shortcut[] = [
  { keys: ["Space"], action: "Hiện đáp án và phát audio" },
  { keys: ["R"], action: "Phát lại audio", note: "Dùng sau khi đã hiện đáp án." },
  { keys: ["P"], action: "Bật hoặc tắt pinyin" },
  { keys: ["W"], action: "Bật hoặc tắt luyện viết" },
  { keys: ["1"], action: "Đánh giá Quên", note: "Dùng sau khi đã hiện đáp án." },
  { keys: ["2"], action: "Đánh giá Khó", note: "Dùng sau khi đã hiện đáp án." },
  { keys: ["3"], action: "Đánh giá Nhớ", note: "Dùng sau khi đã hiện đáp án." },
  { keys: ["4"], action: "Đánh giá Dễ", note: "Dùng sau khi đã hiện đáp án." },
];

const sentenceShortcuts: Shortcut[] = [
  { keys: ["D"], action: "Bật hoặc tắt chế độ chính tả" },
  {
    keys: ["Ctrl"],
    action: "Phát lại audio",
    note: "Nhấn rồi thả riêng phím Ctrl trong Luyện câu.",
  },
  {
    keys: ["Enter"],
    action: "Kiểm tra câu đã nhập",
    note: "Dùng khi con trỏ đang ở trong ô nhập.",
  },
  {
    keys: ["Shift", "Enter"],
    action: "Xuống dòng trong ô nhập",
  },
];

function ShortcutTable({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div className="divide-y divide-zinc-200 border-y border-zinc-200">
      {shortcuts.map((shortcut) => (
        <div
          className="grid gap-2 py-3 sm:grid-cols-[180px_1fr] sm:items-center"
          key={`${shortcut.keys.join("+")}-${shortcut.action}`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {shortcut.keys.map((key, index) => (
              <span className="contents" key={key}>
                {index > 0 ? <span className="text-zinc-400">+</span> : null}
                <kbd className="min-w-8 rounded border border-zinc-300 bg-white px-2 py-1 text-center font-mono text-xs font-semibold text-zinc-800 shadow-sm">
                  {key}
                </kbd>
              </span>
            ))}
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-900">
              {shortcut.action}
            </div>
            {shortcut.note ? (
              <div className="mt-1 text-xs leading-5 text-zinc-500">
                {shortcut.note}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ShortcutsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                Hướng dẫn sử dụng
              </p>
              <h1 className="mt-2 text-2xl font-semibold">Phím tắt khi học</h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Dùng bàn phím để lật thẻ, nghe lại và đánh giá mà không cần rời tay khỏi bài học.
              </p>
            </div>
            <Link
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100"
              href="/study-sentences"
            >
              Quay lại
            </Link>
          </div>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Ôn từ và luyện câu</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              Các phím dùng chung trong hai chế độ học.
            </p>
            <ShortcutTable shortcuts={sharedShortcuts} />
          </section>

          <section className="mt-9">
            <h2 className="text-lg font-semibold">Luyện câu và chính tả</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">
              Các phím bổ sung khi nhập câu tiếng Trung.
            </p>
            <ShortcutTable shortcuts={sentenceShortcuts} />
          </section>

          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:text-amber-200">
            Khi đang gõ trong ô nhập, các phím chữ và số sẽ không kích hoạt chế độ học. Space và Enter vẫn thực hiện chức năng riêng của bài luyện viết.
          </div>
        </div>
      </AppShell>
    </AuthGuard>
  );
}
