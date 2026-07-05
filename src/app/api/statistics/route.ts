import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type LearnedReviewRow = {
  id: string;
  first_reviewed_at: string | null;
  review_count: number | null;
  updated_at: string | null;
};

const pageSize = 1000;
const maxPages = 5;

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const datesByReviewId = new Map<string, string>();

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const { data, error } = await supabase
      .from("reviews")
      .select("id, first_reviewed_at, review_count, updated_at")
      .eq("user_id", user.id)
      .gt("review_count", 0)
      .order("updated_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(error);
      return NextResponse.json(
        {
          error: error.message.includes("first_reviewed_at")
            ? "Thiếu dữ liệu ngày học đầu tiên. Hãy chạy migration 015_first_reviewed_at.sql trong Supabase."
            : "Không thể tải thống kê học tập.",
        },
        { status: 500 },
      );
    }

    const rows = (data || []) as LearnedReviewRow[];
    rows.forEach((row) => {
      const learnedAt = row.first_reviewed_at || row.updated_at;

      if (learnedAt) {
        datesByReviewId.set(row.id, learnedAt);
      }
    });

    if (rows.length < pageSize) {
      break;
    }
  }

  return NextResponse.json({
    learnedDates: Array.from(datesByReviewId.values()),
  });
}
