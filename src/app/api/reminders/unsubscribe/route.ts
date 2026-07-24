import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// One-click unsubscribe from the reminder email. The token is the credential —
// no login needed — so a learner can turn reminders off straight from the mail.
function htmlPage(title: string, body: string) {
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f6f8f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
  <div style="max-width:440px;margin:60px auto;padding:0 20px;text-align:center">
    <div style="background:#fff;border:1px solid #e4e4df;border-radius:16px;padding:32px">
      <h1 style="margin:0 0 10px;font-size:20px">${title}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#52525b">${body}</p>
      <a href="https://www.tiengtrunghihi.com" style="color:#0f766e;font-weight:600;text-decoration:none">Về trang chủ</a>
    </div>
  </div>
</body></html>`;
}

function respond(title: string, body: string, status = 200) {
  return new Response(htmlPage(title, body), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token) {
    return respond("Liên kết không hợp lệ", "Thiếu mã huỷ nhận.", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_study_settings")
    .update({ email_reminders_enabled: false })
    .eq("reminder_unsubscribe_token", token)
    .select("user_id")
    .maybeSingle();

  if (error) {
    console.error("unsubscribe failed", error);
    return respond(
      "Có lỗi xảy ra",
      "Không thể huỷ nhận lúc này. Bạn có thể tắt trong phần Cài đặt của app.",
      500,
    );
  }

  if (!data) {
    return respond(
      "Liên kết không hợp lệ",
      "Mã huỷ nhận không đúng hoặc đã hết hạn.",
      404,
    );
  }

  return respond(
    "Đã huỷ nhắc học",
    "Bạn sẽ không nhận email nhắc học nữa. Có thể bật lại bất cứ lúc nào trong Cài đặt.",
  );
}
