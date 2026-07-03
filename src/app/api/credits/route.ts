import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { createCreditErrorResponse, getUserCredits } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  try {
    const credits = await getUserCredits(supabase, user.id);
    return NextResponse.json({ credits });
  } catch (error) {
    console.error(error);
    const creditResponse = createCreditErrorResponse(error);

    if (creditResponse) {
      return creditResponse;
    }

    return NextResponse.json(
      { error: "Không thể tải credit" },
      { status: 500 },
    );
  }
}
