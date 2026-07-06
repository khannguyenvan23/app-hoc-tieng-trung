import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AnalyticsEventName =
  | "page_view"
  | "signup_submitted"
  | "email_verified"
  | "first_study"
  | "daily_active"
  | "returned_next_day";

type AnalyticsEvent = {
  eventName: AnalyticsEventName;
  dedupeKey: string;
  anonymousId?: string | null;
  userId?: string | null;
  path?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt?: string;
};

export async function recordAnalyticsEvent(event: AnalyticsEvent) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("analytics_events").upsert(
      {
        event_name: event.eventName,
        anonymous_id: event.anonymousId || null,
        user_id: event.userId || null,
        path: event.path || null,
        metadata: event.metadata || {},
        dedupe_key: event.dedupeKey,
        ...(event.createdAt ? { created_at: event.createdAt } : {}),
      },
      {
        ignoreDuplicates: true,
        onConflict: "dedupe_key",
      },
    );

    if (error) {
      console.warn("Analytics event was not recorded:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Analytics event was not recorded:", error);
    return false;
  }
}

export function toVietnamDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
