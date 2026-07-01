"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
