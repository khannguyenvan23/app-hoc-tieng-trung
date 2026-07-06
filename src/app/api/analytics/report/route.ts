import { NextResponse } from "next/server";
import { z } from "zod";
import { toVietnamDateKey } from "@/lib/analytics";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const querySchema = z.enum(["7", "30", "90"]);
const pageSize = 1000;
const maxPages = 20;

type EventRow = {
  anonymous_id: string | null;
  created_at: string;
  event_name: string;
  user_id: string | null;
};

type AuthUserRow = {
  id: string;
  created_at: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

function getAdminEmails() {
  return new Set(
    (process.env.ANALYTICS_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function fetchAllUsers() {
  const supabase = createSupabaseAdminClient();
  const users: AuthUserRow[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });

    if (error) {
      throw error;
    }

    users.push(...(data.users as AuthUserRow[]));

    if (data.users.length < pageSize) {
      break;
    }
  }

  return users;
}

async function fetchEvents(eventNames: string[], startIso?: string) {
  const supabase = createSupabaseAdminClient();
  const events: EventRow[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    let query = supabase
      .from("analytics_events")
      .select("event_name, anonymous_id, user_id, created_at")
      .in("event_name", eventNames)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (startIso) {
      query = query.gte("created_at", startIso);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data || []) as EventRow[];
    events.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return events;
}

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const adminEmails = getAdminEmails();

  if (!adminEmails.size) {
    return NextResponse.json(
      { error: "Analytics admin is not configured" },
      { status: 503 },
    );
  }

  if (!user.email || !adminEmails.has(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requestUrl = new URL(request.url);
  const daysResult = querySchema.safeParse(requestUrl.searchParams.get("days") || "30");
  const days = daysResult.success ? Number(daysResult.data) : 30;
  const todayKey = toVietnamDateKey(new Date());
  const firstDay = new Date(`${todayKey}T00:00:00.000Z`);
  firstDay.setUTCDate(firstDay.getUTCDate() - days + 1);
  const firstDayKey = firstDay.toISOString().slice(0, 10);
  const start = new Date(`${firstDayKey}T00:00:00+07:00`);

  try {
    const [allUsers, rangeEvents, milestoneEvents] = await Promise.all([
      fetchAllUsers(),
      fetchEvents(["page_view", "daily_active", "first_study"], start.toISOString()),
      fetchEvents(["first_study", "returned_next_day"]),
    ]);

    const cohortUsers = allUsers.filter(
      (authUser) => new Date(authUser.created_at).getTime() >= start.getTime(),
    );
    const cohortUserIds = new Set(cohortUsers.map((authUser) => authUser.id));
    const studiedUserIds = new Set(
      milestoneEvents
        .filter((event) => event.event_name === "first_study" && event.user_id)
        .map((event) => event.user_id as string),
    );
    const returnedUserIds = new Set(
      milestoneEvents
        .filter((event) => event.event_name === "returned_next_day" && event.user_id)
        .map((event) => event.user_id as string),
    );
    const visitors = new Set(
      rangeEvents
        .filter((event) => event.event_name === "page_view" && event.anonymous_id)
        .map((event) => event.anonymous_id as string),
    );
    const verifiedUsers = cohortUsers.filter(
      (authUser) => authUser.email_confirmed_at || authUser.confirmed_at,
    );
    const firstStudyCount = Array.from(cohortUserIds).filter((id) =>
      studiedUserIds.has(id),
    ).length;
    const returnedNextDayCount = Array.from(cohortUserIds).filter((id) =>
      returnedUserIds.has(id),
    ).length;

    const dailyMap = new Map<
      string,
      {
        activeUsers: Set<string>;
        firstStudy: number;
        registrations: number;
        verified: number;
        visitors: Set<string>;
      }
    >();

    for (let index = 0; index < days; index += 1) {
      const date = new Date(`${firstDayKey}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + index);
      dailyMap.set(date.toISOString().slice(0, 10), {
        activeUsers: new Set(),
        firstStudy: 0,
        registrations: 0,
        verified: 0,
        visitors: new Set(),
      });
    }

    rangeEvents.forEach((event) => {
      const day = dailyMap.get(toVietnamDateKey(event.created_at));

      if (!day) {
        return;
      }

      if (event.event_name === "page_view" && event.anonymous_id) {
        day.visitors.add(event.anonymous_id);
      } else if (event.event_name === "daily_active" && event.user_id) {
        day.activeUsers.add(event.user_id);
      } else if (event.event_name === "first_study") {
        day.firstStudy += 1;
      }
    });

    cohortUsers.forEach((authUser) => {
      const signupDay = dailyMap.get(toVietnamDateKey(authUser.created_at));

      if (signupDay) {
        signupDay.registrations += 1;
      }

      const confirmedAt = authUser.email_confirmed_at || authUser.confirmed_at;

      if (confirmedAt) {
        const verifiedDay = dailyMap.get(toVietnamDateKey(confirmedAt));

        if (verifiedDay) {
          verifiedDay.verified += 1;
        }
      }
    });

    return NextResponse.json({
      daily: Array.from(dailyMap.entries()).map(([date, values]) => ({
        activeUsers: values.activeUsers.size,
        date,
        firstStudy: values.firstStudy,
        registrations: values.registrations,
        verified: values.verified,
        visitors: values.visitors.size,
      })),
      days,
      funnel: {
        firstStudy: firstStudyCount,
        registrations: cohortUsers.length,
        returnedNextDay: returnedNextDayCount,
        verified: verifiedUsers.length,
        visitors: visitors.size,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes("analytics_events")
            ? "Hãy chạy migration 020_analytics_funnel.sql trong Supabase."
            : "Không thể tải Analytics.",
      },
      { status: 500 },
    );
  }
}
