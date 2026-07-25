"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ApiErrorPayload = {
  code?: string;
  error?: string;
  credits?: {
    balance?: number;
    required?: number;
  };
};

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return Boolean(value && typeof value === "object");
}

// True only for a real "out of credits" response (HTTP 402 from
// createCreditErrorResponse). Other server failures — a TTS outage, a missing
// storage bucket — must not be dressed up as a billing problem.
export function isInsufficientCreditsPayload(data: unknown): boolean {
  if (!isApiErrorPayload(data)) {
    return false;
  }

  if (data.code === "insufficient_credits") {
    return true;
  }

  return (
    typeof data.credits?.balance === "number" &&
    typeof data.credits?.required === "number"
  );
}

export function getApiErrorMessage(data: unknown, fallback: string) {
  if (!isApiErrorPayload(data)) {
    return fallback;
  }

  const error = typeof data.error === "string" ? data.error : "";
  const balance = data.credits?.balance;
  const required = data.credits?.required;

  if (typeof balance === "number" && typeof required === "number") {
    return `Không đủ credit. Cần ${required} credit, tài khoản còn ${balance} credit. Vào Nạp credit để tiếp tục.`;
  }

  return error || fallback;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
  });
}
