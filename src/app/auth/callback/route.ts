import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeNextPath(requestUrl.searchParams.get("next"));
  const redirectUrl = new URL(next, requestUrl.origin);

  if (!code) {
    // Supabase can return an implicit-flow session in the URL fragment.
    // Fragments are invisible to the server but survive this clean redirect
    // and are consumed by the browser client on the destination page.
    return NextResponse.redirect(redirectUrl, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    redirectUrl.searchParams.set("auth_error", "callback_failed");
    return NextResponse.redirect(redirectUrl, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await recordAnalyticsEvent({
      dedupeKey: `email_verified:${user.id}`,
      eventName: "email_verified",
      userId: user.id,
    });
  }

  return NextResponse.redirect(redirectUrl, {
    headers: { "Cache-Control": "no-store" },
  });
}
