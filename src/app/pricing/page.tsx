import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getUserCredits, type UserCreditSummary } from "@/lib/credits";
import { hasPublicEnv } from "@/lib/env";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Bảng giá credit - ${siteConfig.name}`,
  description:
    "Bảng giá credit Tiếng Trung Hihi cho import AI, tạo câu luyện tập và audio tiếng Trung.",
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: `Bảng giá credit - ${siteConfig.name}`,
    description:
      "Ôn tập miễn phí. Credit chỉ dùng khi tạo dữ liệu bằng AI hoặc tạo audio tiếng Trung.",
    url: absoluteSiteUrl("/pricing"),
    type: "website",
  },
};

const rawContactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "";
const contactPhone = rawContactPhone || "Cập nhật NEXT_PUBLIC_CONTACT_PHONE";
const phoneDigits = rawContactPhone.replace(/[^\d+]/g, "");
const zaloDigits = rawContactPhone.replace(/\D/g, "");
const supportPhone = "0986942504";
const supportPhoneDigits = supportPhone.replace(/\D/g, "");

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

function PricingContent({
  creditError,
  credits,
  signedIn,
}: {
  creditError?: string;
  credits?: UserCreditSummary | null;
  signedIn: boolean;
}) {
  return (
    <>
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
              {signedIn ? (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-zinc-50"
                  href="/dashboard"
                >
                  Quay lại dashboard
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-stone-50 p-5">
            {signedIn ? (
              <div className="mb-4 rounded-md border border-teal-100 bg-teal-50 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-teal-800">
                      Credit còn lại
                    </div>
                    <div className="mt-1 text-4xl font-semibold text-teal-950">
                      {credits ? credits.credit_balance : "..."}
                    </div>
                  </div>
                  <div className="text-right text-sm text-teal-900">
                    <div>Gói {credits?.plan || "free"}</div>
                    <div className="mt-1 text-xs">
                      Tổng đã nhận {credits?.lifetime_credits || 0} credit
                    </div>
                  </div>
                </div>
                {creditError ? (
                  <p className="mt-3 text-sm text-red-700">{creditError}</p>
                ) : null}
              </div>
            ) : null}
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
            {rawContactPhone ? (
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Số điện thoại/Zalo: {" "}
                <span className="font-medium">{contactPhone}</span>
              </p>
            ) : null}
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Điện thoại liên hệ: {" "}
              <a
                className="font-medium text-teal-800 hover:underline"
                href={`tel:${supportPhoneDigits}`}
              >
                {supportPhone}
              </a>
            </p>
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-zinc-600">
          <div>© 2026 Tiếng Trung Hihi</div>
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
    </>
  );
}

async function getPricingSession() {
  if (!hasPublicEnv()) {
    return {
      creditError: "",
      credits: null,
      signedIn: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      creditError: "",
      credits: null,
      signedIn: false,
    };
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    const credits = await getUserCredits(adminSupabase, user.id);

    return {
      creditError: "",
      credits,
      signedIn: true,
    };
  } catch (error) {
    console.error(error);

    return {
      creditError: "Không thể tải số dư credit.",
      credits: null,
      signedIn: true,
    };
  }
}

export default async function PricingPage() {
  const { creditError, credits, signedIn } = await getPricingSession();

  if (signedIn) {
    return (
      <AppShell>
        <PricingContent
          creditError={creditError}
          credits={credits}
          signedIn
        />
      </AppShell>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link className="font-semibold" href="/">
            Tiếng Trung Hihi
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
      <PricingContent signedIn={false} />
    </main>
  );
}
