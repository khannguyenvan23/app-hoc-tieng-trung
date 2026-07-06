import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addDaysToDateKey, recordAnalyticsEvent, toVietnamDateKey } from "@/lib/analytics";
import { getRequestUser } from "@/lib/auth";

const publicEventSchema = z.object({
  eventName: z.enum(["page_view", "signup_submitted"]),
  path: z.string().max(300).startsWith("/").default("/"),
  sessionId: z.string().uuid(),
  visitorId: z.string().uuid(),
});

const activeEventSchema = z.object({
  eventName: z.literal("daily_active"),
});

function shortHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const publicEvent = publicEventSchema.safeParse(json);

  if (publicEvent.success) {
    const { eventName, path, sessionId, visitorId } = publicEvent.data;
    const dedupeKey =
      eventName === "page_view"
        ? `page_view:${sessionId}:${shortHash(path)}`
        : `signup_submitted:${visitorId}`;

    await recordAnalyticsEvent({
      anonymousId: visitorId,
      dedupeKey,
      eventName,
      path,
      metadata: eventName === "page_view" ? { sessionId } : {},
    });

    return NextResponse.json({ success: true }, { status: 202 });
  }

  const activeEvent = activeEventSchema.safeParse(json);

  if (!activeEvent.success) {
    return NextResponse.json({ error: "Invalid analytics event" }, { status: 400 });
  }

  const { user, error } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const today = toVietnamDateKey(new Date());
  await recordAnalyticsEvent({
    dedupeKey: `daily_active:${user.id}:${today}`,
    eventName: "daily_active",
    userId: user.id,
  });

  const signupDate = toVietnamDateKey(user.created_at);

  if (today === addDaysToDateKey(signupDate, 1)) {
    await recordAnalyticsEvent({
      dedupeKey: `returned_next_day:${user.id}`,
      eventName: "returned_next_day",
      userId: user.id,
    });
  }

  return NextResponse.json({ success: true }, { status: 202 });
}
