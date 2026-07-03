import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bảng giá credit - Hanzi Cards",
  description:
    "Bảng giá credit Hanzi Cards cho import AI, tạo câu luyện tập và audio tiếng Trung.",
};

const rawContactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "";
const contactPhone = rawContactPhone || "Cập nhật NEXT_PUBLIC_CONTACT_PHONE";
const phoneDigits = rawContactPhone.replace(/[^\d+]/g, "");
const zaloDigits = rawContactPhone.replace(/\D/g, "");

const creditPlans = [
  {
    name: "Dùng thử",
    credits: "100 credit",
    price: "Miễn phí",
    description: "Tự động có khi tạo tài khoản mới.",
    highlight: false,
  },
  {
    name: "Gói nhỏ",
    credits: "300 credit",
    price: "29.000đ",
    description: "Phù hợp để import thêm từ riêng hoặc tạo audio bổ sung.",
    highlight: false,
  },
  {
    name: "Gói học đều",
    credits: "800 credit",
    price: "59.000đ",
    description: "Phù hợp học HSK theo tuần, tạo câu và audio thường xuyên.",
    highlight: true,
  },
  {
    name: "Gói nhiều",
    credits: "2.000 credit",
    price: "129.000đ",
    description: "Phù hợp import nhiều bộ từ vựng hoặc dùng cho lớp nhỏ.",
    highlight: false,
  },
];

const usageRules = [
  ["Import từ bằng AI", "1 credit / từ"],
  ["Tạo câu luyện tập bằng AI", "2 credit / câu"],
  ["Tạo audio từ vựng hoặc câu", "1 credit / file audio"],
  ["Ôn tập thẻ đã có sẵn", "0 credit"],
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link className="font-semibold" href="/">
            Hanzi Cards
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              className="rounded-md px-3 py-2 hover:bg-zinc-100"
              href="/login"
            >
              Đăng nhập
            </Link>
            <Link
              className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
              href="/login"
            >
              Bắt đầu học
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-medium uppercase text-teal-800">
              Credit cho AI và audio
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Nạp credit để import từ vựng, tạo câu và audio
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
              Ôn tập hằng ngày không tốn credit. Credit chỉ dùng cho những thao
              tác có chi phí AI như tạo dữ liệu bằng AI hoặc tạo audio phát âm.
              Hiện tại nạp credit qua liên hệ trực tiếp.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {phoneDigits ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
                  href={`tel:${phoneDigits}`}
                >
                  Gọi {contactPhone}
                </a>
              ) : (
                <span className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700">
                  Chưa cấu hình số điện thoại
                </span>
              )}
              {zaloDigits ? (
                <a
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-zinc-50"
                  href={`https://zalo.me/${zaloDigits}`}
                >
                  Nhắn Zalo
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-stone-50 p-5">
            <h2 className="text-lg font-semibold">Cách dùng credit</h2>
            <div className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
              {usageRules.map(([label, value]) => (
                <div
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  key={label}
                >
                  <span className="text-zinc-600">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              Khi hết credit, app sẽ chặn trước khi gọi AI để tránh phát sinh
              chi phí ngoài ý muốn.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {creditPlans.map((plan) => (
            <article
              className={`rounded-lg border bg-white p-5 shadow-sm ${
                plan.highlight
                  ? "border-teal-700 ring-2 ring-teal-100"
                  : "border-zinc-200"
              }`}
              key={plan.name}
            >
              {plan.highlight ? (
                <div className="mb-3 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
                  Gợi ý
                </div>
              ) : null}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <div className="mt-4 text-3xl font-semibold">{plan.price}</div>
              <div className="mt-2 text-sm font-medium text-teal-800">
                {plan.credits}
              </div>
              <p className="mt-3 min-h-20 text-sm leading-6 text-zinc-600">
                {plan.description}
              </p>
              {phoneDigits ? (
                <a
                  className={`mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${
                    plan.highlight
                      ? "bg-teal-700 text-white hover:bg-teal-800"
                      : "border border-zinc-300 hover:bg-zinc-50"
                  }`}
                  href={`tel:${phoneDigits}`}
                >
                  Liên hệ nạp credit
                </a>
              ) : (
                <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                  Thêm số điện thoại trong env để bật liên hệ.
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 md:grid-cols-3">
          <div>
            <h2 className="text-lg font-semibold">Sau khi chuyển khoản</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Gửi email tài khoản và gói muốn nạp qua số điện thoại/Zalo. Admin
              sẽ cộng credit thủ công vào tài khoản.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Credit không trừ khi ôn</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Học flashcard, luyện câu, chọn Quên/Khó/Nhớ/Dễ và xem lại audio
              đã có sẵn đều không tốn credit.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Liên hệ</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Số điện thoại/Zalo: <span className="font-medium">{contactPhone}</span>
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-zinc-600">
          <div>© 2026 Hanzi Cards</div>
          <nav className="flex flex-wrap gap-4">
            <Link className="hover:text-teal-800 hover:underline" href="/privacy">
              Chính sách bảo mật
            </Link>
            <Link className="hover:text-teal-800 hover:underline" href="/terms">
              Điều khoản sử dụng
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
