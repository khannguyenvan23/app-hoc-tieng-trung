import { NextResponse } from "next/server";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  buildReminderEmail,
  countDueForUser,
  getReminderTargets,
} from "@/lib/reminders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Called by Vercel Cron once a day (see vercel.json). Vercel attaches
// `Authorization: Bearer $CRON_SECRET` automatically, so we reject anything
// that does not carry the secret — this endpoint must not be publicly callable.
function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email chưa được cấu hình (RESEND_API_KEY / REMINDER_FROM_EMAIL)." },
      { status: 503 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  let targets;
  try {
    targets = await getReminderTargets(supabase);
  } catch (error) {
    console.error("reminders: cannot load targets", error);
    return NextResponse.json(
      { error: "Không thể tải danh sách nhắc học." },
      { status: 500 },
    );
  }

  let sent = 0;
  let skippedNoDue = 0;
  let failed = 0;

  for (const target of targets) {
    const dueCount = await countDueForUser(supabase, target.userId, nowIso);

    if (dueCount <= 0) {
      skippedNoDue += 1;
      continue;
    }

    const { data: userData } = await supabase.auth.admin.getUserById(
      target.userId,
    );
    const email = userData?.user?.email;

    if (!email) {
      failed += 1;
      continue;
    }

    const { subject, html } = buildReminderEmail({
      dueCount,
      unsubscribeToken: target.unsubscribeToken,
    });
    const result = await sendEmail({ to: email, subject, html });

    if (result.sent) {
      sent += 1;
    } else if (!result.skipped) {
      failed += 1;
      console.error("reminders: send failed", target.userId, result.error);
    }
  }

  return NextResponse.json({
    ok: true,
    targets: targets.length,
    sent,
    skippedNoDue,
    failed,
  });
}
