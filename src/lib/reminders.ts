import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { absoluteSiteUrl, siteConfig } from "@/lib/site";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type ReminderTarget = {
  userId: string;
  unsubscribeToken: string;
};

// Users who turned the daily email reminder on. reminder_unsubscribe_token may
// be missing before migration 038 — those rows are skipped.
export async function getReminderTargets(
  supabase: SupabaseAdminClient,
): Promise<ReminderTarget[]> {
  const { data, error } = await supabase
    .from("user_study_settings")
    .select("user_id, reminder_unsubscribe_token")
    .eq("email_reminders_enabled", true);

  if (error) {
    throw new Error(error.message);
  }

  return (data || [])
    .filter((row) => row.user_id && row.reminder_unsubscribe_token)
    .map((row) => ({
      userId: row.user_id as string,
      unsubscribeToken: row.reminder_unsubscribe_token as string,
    }));
}

// How many learned cards (words + sentences) are due for review right now.
export async function countDueForUser(
  supabase: SupabaseAdminClient,
  userId: string,
  nowIso = new Date().toISOString(),
): Promise<number> {
  const countDue = async (table: "reviews" | "sentence_reviews") => {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("review_count", 0)
      .lte("next_review_at", nowIso);

    return count || 0;
  };

  const [words, sentences] = await Promise.all([
    countDue("reviews"),
    countDue("sentence_reviews"),
  ]);

  return words + sentences;
}

export function buildReminderEmail({
  dueCount,
  unsubscribeToken,
}: {
  dueCount: number;
  unsubscribeToken: string;
}) {
  const studyUrl = absoluteSiteUrl("/study");
  const unsubscribeUrl = absoluteSiteUrl(
    `/api/reminders/unsubscribe?token=${unsubscribeToken}`,
  );

  const subject = `Bạn có ${dueCount} thẻ tiếng Trung đến hạn ôn`;

  const html = `<!doctype html>
<html lang="vi"><body style="margin:0;background:#f6f8f7;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#18181b">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border:1px solid #e4e4df;border-radius:16px;padding:28px">
      <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#0f766e">
        ${siteConfig.name}
      </div>
      <h1 style="margin:12px 0 8px;font-size:22px;line-height:1.3">
        Có ${dueCount} thẻ đang chờ bạn ôn
      </h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b">
        Ôn đúng lúc là cách nhớ lâu nhất. Mở app và dọn phần đến hạn hôm nay nhé.
      </p>
      <a href="${studyUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:10px">
        Vào ôn ngay
      </a>
    </div>
    <p style="margin:20px 4px 0;font-size:12px;line-height:1.6;color:#a1a1aa">
      Bạn nhận email này vì đã bật nhắc học.
      <a href="${unsubscribeUrl}" style="color:#71717a">Huỷ nhận nhắc học</a>.
    </p>
  </div>
</body></html>`;

  return { subject, html };
}
