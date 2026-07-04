"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ApiErrorPayload = {
  error?: string;
  credits?: {
    balance?: number;
    required?: number;
  };
};

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return Boolean(value && typeof value === "object");
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
