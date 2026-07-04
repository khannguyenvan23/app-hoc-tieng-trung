import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export const freeStartingCredits = 100;

export const creditCosts = {
  cardAi: 1,
  sentenceAi: 2,
  ttsAudio: 1,
} as const;

type CreditRpcRow = {
  success?: boolean;
  balance?: number;
  required?: number;
};

export type UserCreditSummary = {
  plan: string;
  credit_balance: number;
  lifetime_credits: number;
  monthly_credit_limit: number;
};

export class InsufficientCreditsError extends Error {
  balance: number;
  required: number;

  constructor(required: number, balance: number) {
    super(
      `Không đủ credit. Cần ${required} credit, tài khoản còn ${balance} credit.`,
    );
    this.name = "InsufficientCreditsError";
    this.required = required;
    this.balance = balance;
  }
}

export class CreditSystemError extends Error {
  constructor() {
    super(
      "Hệ thống credit chưa sẵn sàng. Hãy chạy migration supabase/migrations/012_credit_system.sql trong Supabase.",
    );
    this.name = "CreditSystemError";
  }
}

function getRpcRow(data: unknown): CreditRpcRow | null {
  if (Array.isArray(data)) {
    return (data[0] as CreditRpcRow | undefined) || null;
  }

  return (data as CreditRpcRow | null) || null;
}

export function createCreditErrorResponse(error: unknown) {
  if (error instanceof InsufficientCreditsError) {
    return NextResponse.json(
      {
        code: "insufficient_credits",
        error: error.message,
        credits: {
          balance: error.balance,
          required: error.required,
        },
      },
      { status: 402 },
    );
  }

  if (error instanceof CreditSystemError) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return null;
}

export async function getUserCredits(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase.rpc("ensure_user_credits", {
    p_user_id: userId,
  });

  if (error || !data) {
    console.error(error);
    throw new CreditSystemError();
  }

  return (Array.isArray(data) ? data[0] : data) as UserCreditSummary;
}

export async function spendCredits({
  supabase,
  userId,
  credits,
  eventType,
  metadata = {},
}: {
  supabase: SupabaseClient;
  userId: string;
  credits: number;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  if (credits <= 0) {
    const summary = await getUserCredits(supabase, userId);
    return {
      balance: summary.credit_balance,
      creditsUsed: 0,
    };
  }

  const { data, error } = await supabase.rpc("spend_user_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_event_type: eventType,
    p_metadata: metadata,
  });

  if (error) {
    console.error(error);
    throw new CreditSystemError();
  }

  const row = getRpcRow(data);

  if (!row?.success) {
    throw new InsufficientCreditsError(
      Number(row?.required || credits),
      Number(row?.balance || 0),
    );
  }

  return {
    balance: Number(row.balance || 0),
    creditsUsed: credits,
  };
}

export async function refundCredits({
  supabase,
  userId,
  credits,
  eventType,
  metadata = {},
}: {
  supabase: SupabaseClient;
  userId: string;
  credits: number;
  eventType: string;
  metadata?: Record<string, unknown>;
}) {
  if (credits <= 0) {
    return null;
  }

  const { data, error } = await supabase.rpc("add_user_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_event_type: eventType,
    p_metadata: metadata,
  });

  if (error) {
    console.error(error);
    throw new CreditSystemError();
  }

  return getRpcRow(data);
}
