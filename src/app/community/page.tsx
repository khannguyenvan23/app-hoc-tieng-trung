import type { Metadata } from "next";
import Link from "next/link";
import {
  communityJoinUrl,
  defaultZaloContacts,
  hasZaloGroupUrl,
} from "@/lib/community";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: `Cộng đồng Zalo học tiếng Trung - ${siteConfig.name}`,
  description:
    "Tham gia nhóm Zalo Tiếng Trung Hihi để học cùng mọi người, nhận bộ thẻ gợi ý, hỏi bài và duy trì thói quen ôn tập mỗi ngày.",
  alternates: {
    canonical: "/community",
  },
  openGraph: {
    title: `Cộng đồng Zalo học tiếng Trung - ${siteConfig.name}`,
    description:
      "Vào nhóm Zalo Tiếng Trung Hihi để học tiếng Trung cùng cộng đồng.",
    url: absoluteSiteUrl("/community"),
    type: "website",
  },
};

const groupRules = [
  "Chia sẻ cách học, bộ thẻ và câu hỏi liên quan đến tiếng Trung.",
  "Không spam quảng cáo, không gửi nội dung không liên quan.",
  "Hỏi bài rõ ràng: gửi từ/câu, nghĩa bạn hiểu và phần đang vướng.",
  "Tôn trọng người mới học, góp ý ngắn gọn và dễ hiểu.",
];

export default function CommunityPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <Link className="font-semibold" href="/">
            Tiếng Trung Hihi
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-2 text-zinc-700 hover:bg-zinc-100"
              href="/pricing"
            >
              Bảng giá
            </Link>
            <Link
              className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
              href="/trial"
            >
              Bắt đầu học
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
            Cộng đồng học viên
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Vào nhóm Zalo Tiếng Trung Hihi
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            Tham gia nhóm để học cùng mọi người, nhận gợi ý bộ thẻ, hỏi bài khi
            bí từ/câu và duy trì thói quen ôn tập mỗi ngày.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              className="inline-flex min-h-11 items-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              href={communityJoinUrl}
              rel="noreferrer"
              target="_blank"
            >
              {hasZaloGroupUrl ? "Tham gia nhóm Zalo" : "Nhắn Zalo để nhận link nhóm"}
            </a>
            <Link
              className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 px-5 py-3 text-sm font-semibold hover:bg-zinc-100"
              href="/trial"
            >
              Học thử miễn phí
            </Link>
          </div>

          {!hasZaloGroupUrl ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Chưa cấu hình link nhóm. Thêm{" "}
              <code className="rounded bg-white px-1 py-0.5">
                NEXT_PUBLIC_ZALO_GROUP_URL
              </code>{" "}
              trong Vercel để nút này mở thẳng nhóm Zalo.
            </p>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Trong nhóm có gì?</h2>
          <div className="mt-4 grid gap-3 text-sm text-zinc-700">
            <div className="rounded-xl bg-teal-50 p-4">
              <div className="font-semibold text-teal-900">Hỏi bài nhanh</div>
              <p className="mt-1 leading-6">
                Gửi từ, câu hoặc ảnh màn hình đang vướng để được hỗ trợ.
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 p-4">
              <div className="font-semibold text-sky-900">Nhắc học mỗi ngày</div>
              <p className="mt-1 leading-6">
                Cùng nhau giữ streak và nhắc nhau ôn đúng phần đến hạn.
              </p>
            </div>
            <div className="rounded-xl bg-stone-100 p-4">
              <div className="font-semibold text-zinc-900">Chia sẻ bộ thẻ</div>
              <p className="mt-1 leading-6">
                Gợi ý bộ HSK, câu thường ngày và bộ thẻ do học viên chia sẻ.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-5 pb-14 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Quy định nhóm</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
            {groupRules.map((rule) => (
              <li className="flex gap-3" key={rule}>
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-700" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Liên hệ hỗ trợ</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Nếu link nhóm lỗi hoặc cần hỗ trợ nạp credit, bạn có thể nhắn trực
            tiếp qua Zalo.
          </p>
          <div className="mt-4 grid gap-2">
            {defaultZaloContacts.map((contact) => (
              <a
                className="rounded-md border border-zinc-200 px-4 py-3 text-sm hover:border-blue-300 hover:bg-blue-50"
                href={`https://zalo.me/${contact.phone}`}
                key={contact.phone}
                rel="noreferrer"
                target="_blank"
              >
                <span className="text-zinc-500">{contact.label}: </span>
                <span className="font-semibold text-blue-700">
                  {contact.phone}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

