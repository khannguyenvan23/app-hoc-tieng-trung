import type { Metadata } from "next";
import Link from "next/link";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";

const lastUpdated = "03/07/2026";
const contactEmail = "support@khanweb.vn";

export const metadata: Metadata = {
  title: `Điều khoản sử dụng - ${siteConfig.name}`,
  description:
    "Điều khoản sử dụng Tiếng Trung Hihi cho tài khoản, nội dung học tập, AI, audio và giới hạn dịch vụ.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: `Điều khoản sử dụng - ${siteConfig.name}`,
    description:
      "Điều khoản sử dụng Tiếng Trung Hihi cho tài khoản, nội dung học tập, AI, audio và giới hạn dịch vụ.",
    url: absoluteSiteUrl("/terms"),
    type: "article",
  },
};

export default function TermsPage() {
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
          Điều khoản sử dụng
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Điều khoản sử dụng</h1>
        <p className="mt-3 text-sm text-zinc-600">
          Cập nhật lần cuối: {lastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-zinc-700">
          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              1. Chấp nhận điều khoản
            </h2>
            <p className="mt-3">
              Khi truy cập hoặc sử dụng Tiếng Trung Hihi, bạn đồng ý tuân thủ các
              điều khoản này và Chính sách bảo mật của app. Nếu bạn không đồng
              ý, vui lòng không sử dụng dịch vụ.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              2. Mục đích dịch vụ
            </h2>
            <p className="mt-3">
              Tiếng Trung Hihi là công cụ hỗ trợ học từ vựng tiếng Trung bằng
              flashcard, câu ví dụ, audio và lặp lại ngắt quãng. App không thay
              thế giáo viên, khóa học chính thức hoặc chứng nhận ngôn ngữ.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              3. Tài khoản của bạn
            </h2>
            <p className="mt-3">
              Bạn chịu trách nhiệm bảo mật email, mật khẩu và các hoạt động xảy
              ra trong tài khoản của mình. Hãy dùng thông tin chính xác và báo
              cho chúng tôi nếu bạn nghi ngờ tài khoản bị truy cập trái phép.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              4. Nội dung do bạn nhập
            </h2>
            <p className="mt-3">
              Bạn chịu trách nhiệm với từ vựng, câu, ghi chú hoặc nội dung bạn
              nhập vào app. Bạn không được nhập nội dung bất hợp pháp, xâm phạm
              quyền của người khác, mã độc, thông tin nhạy cảm hoặc dữ liệu cá
              nhân của người khác nếu không có quyền.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              5. Nội dung AI và độ chính xác
            </h2>
            <p className="mt-3">
              Nghĩa tiếng Việt, pinyin, câu ví dụ và audio có thể được tạo hoặc
              hỗ trợ bởi AI. Nội dung AI có thể sai, thiếu tự nhiên hoặc không
              phù hợp với mọi ngữ cảnh. Bạn nên kiểm tra lại trước khi dùng cho
              học tập quan trọng, giảng dạy hoặc xuất bản.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              6. Sử dụng hợp lý
            </h2>
            <p className="mt-3">
              Bạn không được cố gắng phá hoại hệ thống, truy cập dữ liệu của
              người khác, tự động gửi lượng lớn yêu cầu gây quá tải, lạm dụng
              API/AI/audio hoặc dùng app cho mục đích trái pháp luật. Chúng tôi
              có thể giới hạn, tạm dừng hoặc chấm dứt quyền truy cập nếu phát
              hiện hành vi lạm dụng.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              7. Thay đổi và gián đoạn dịch vụ
            </h2>
            <p className="mt-3">
              Chúng tôi có thể cập nhật tính năng, thay đổi giao diện, thêm
              giới hạn sử dụng hoặc tạm ngừng dịch vụ để bảo trì. App có thể bị
              gián đoạn do lỗi kỹ thuật, nhà cung cấp hạ tầng, mạng, Supabase,
              OpenAI hoặc các dịch vụ bên thứ ba.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              8. Sở hữu trí tuệ
            </h2>
            <p className="mt-3">
              Tên Tiếng Trung Hihi, giao diện, mã nguồn và nội dung do app cung cấp
              thuộc về chủ sở hữu app hoặc bên cấp phép tương ứng. Bạn vẫn giữ
              quyền với nội dung học tập do bạn tự nhập, trong phạm vi pháp luật
              cho phép.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              9. Miễn trừ trách nhiệm
            </h2>
            <p className="mt-3">
              Dịch vụ được cung cấp theo hiện trạng. Chúng tôi không đảm bảo app
              luôn không lỗi, luôn khả dụng, hoặc mọi nội dung học tập đều chính
              xác tuyệt đối. Trong phạm vi pháp luật cho phép, chúng tôi không
              chịu trách nhiệm cho thiệt hại gián tiếp phát sinh từ việc sử dụng
              app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-950">
              10. Liên hệ
            </h2>
            <p className="mt-3">
              Nếu có câu hỏi về điều khoản sử dụng, vui lòng liên hệ:{" "}
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
