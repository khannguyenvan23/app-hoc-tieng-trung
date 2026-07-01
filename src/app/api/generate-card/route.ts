import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCardData } from "@/lib/ai";
import { getRequestUser } from "@/lib/auth";

const schema = z.object({
  chinese: z.string().min(1),
  meaning_vi: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const { user, error: authError } = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const body = schema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const card = await generateCardData(
      body.data.chinese,
      body.data.meaning_vi,
    );
    return NextResponse.json(card);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not generate card" },
      { status: 500 },
    );
  }
}
