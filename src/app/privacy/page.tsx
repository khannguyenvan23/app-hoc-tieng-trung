import type { Metadata } from "next";
import Link from "next/link";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";

const lastUpdated = "06/07/2026";
const contactEmail = "support@khanweb.vn";

export const metadata: Metadata = {
  title: `Chính sách bảo mật - ${siteConfig.name}`,
  description:
    "Chính sách bảo mật của Tiếng Trung Hihi về tài khoản, dữ liệu học tập, AI, audio và dịch vụ bên thứ ba.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: `Chính sách bảo mật - ${siteConfig.name}`,
    description:
      "Cách Tiếng Trung Hihi xử lý tài khoản, dữ liệu học tập, AI, audio và dịch vụ bên thứ ba.",
    url: absoluteSiteUrl("/privacy"),
    type: "article",
  },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <Link className="text-lg font-semibold" href="/">
            Tiếng Trung Hihi
          </Link>
          <Link
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
            href="/login"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-800">
          Chính sách bảo mật
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Chính sách bảo mật</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Cập nhật lần cuối: {lastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              1. Chúng tôi thu thập thông tin nào
            </h2>
            <p className="mt-3">
              Khi bạn dùng Tiếng Trung Hihi, app có thể lưu email đăng nhập, trạng
              thái tài khoản, bộ thẻ, từ vựng, câu luyện tập, tiến độ ôn tập,
              lựa chọn học như tốc độ audio, bật/tắt pinyin và giới hạn học mỗi
              ngày.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              2. Cách chúng tôi sử dụng thông tin
            </h2>
            <p className="mt-3">
              Dữ liệu được dùng để đăng nhập, lưu tiến độ học, tạo bộ thẻ cá
              nhân, tính lịch ôn SRS, hiển thị thống kê học tập và cải thiện
              trải nghiệm học tiếng Trung.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              3. AI và audio
            </h2>
            <p className="mt-3">
              Khi bạn import từ vựng hoặc tạo câu bằng AI, nội dung bạn nhập có
              thể được gửi đến nhà cung cấp AI để tạo nghĩa, pinyin, câu ví dụ
              hoặc audio. Bạn không nên nhập thông tin nhạy cảm, mật khẩu, số
              giấy tờ, dữ liệu tài chính hoặc thông tin cá nhân của người khác
              vào phần import.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              4. Dịch vụ bên thứ ba
            </h2>
            <p className="mt-3">
              Tiếng Trung Hihi sử dụng Supabase để quản lý đăng nhập, cơ sở dữ liệu
              và lưu phiên người dùng. App có thể sử dụng OpenAI để tạo nội dung
              học tập và audio, đồng thời sử dụng Vercel Web Analytics để đo lượt
              truy cập ẩn danh và hiệu suất website. Các dịch vụ này xử lý dữ liệu
              theo chính sách và điều khoản riêng của họ.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              5. Cookie và lưu trữ trên trình duyệt
            </h2>
            <p className="mt-3">
              App có thể dùng cookie hoặc localStorage để giữ phiên đăng nhập,
              lưu lựa chọn học như deck đang chọn, tốc độ audio, luyện viết và
              trạng thái bật/tắt pinyin. App cũng lưu một mã khách truy cập ngẫu
              nhiên trong trình duyệt để đếm lượt truy cập và đo các bước sử dụng;
              mã này không chứa email hay nội dung học tập.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              6. Chia sẻ dữ liệu
            </h2>
            <p className="mt-3">
              Chúng tôi không bán dữ liệu cá nhân của bạn. Dữ liệu chỉ được
              chia sẻ khi cần vận hành app, tuân thủ pháp luật, bảo vệ hệ thống
              hoặc xử lý yêu cầu hỗ trợ của bạn.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              7. Bảo mật và lưu giữ dữ liệu
            </h2>
            <p className="mt-3">
              Chúng tôi cố gắng bảo vệ dữ liệu bằng các dịch vụ hạ tầng có cơ
              chế xác thực và phân quyền. Tuy nhiên, không có hệ thống trực
              tuyến nào an toàn tuyệt đối. Dữ liệu học tập được lưu trong thời
              gian tài khoản còn hoạt động hoặc đến khi bạn yêu cầu xóa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              8. Quyền của bạn
            </h2>
            <p className="mt-3">
              Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu tài khoản
              và dữ liệu học tập của mình. Một số dữ liệu có thể cần được giữ
              lại trong thời gian cần thiết để bảo mật, sao lưu hoặc tuân thủ
              pháp luật.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              9. Trẻ em
            </h2>
            <p className="mt-3">
              Tiếng Trung Hihi không chủ động hướng đến trẻ em dưới 13 tuổi. Nếu bạn
              là phụ huynh hoặc người giám hộ và cho rằng trẻ em đã cung cấp dữ
              liệu cá nhân, vui lòng liên hệ để chúng tôi hỗ trợ xử lý.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              10. Liên hệ
            </h2>
            <p className="mt-3">
              Nếu có câu hỏi về chính sách bảo mật, vui lòng liên hệ:{" "}
              <a className="font-medium text-teal-800 underline" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
