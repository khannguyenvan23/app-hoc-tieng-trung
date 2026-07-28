"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnv } from "@/lib/env";

function makeBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Reuse a single client across the whole app. Creating a fresh browser client
// on every call (AuthGuard, fetchWithAuth on every request, each study page…)
// spins up multiple auth managers that each try to rotate the refresh token.
// Supabase rotates the refresh token on use, so when two instances refresh at
// once one invalidates the other and the user is signed out unexpectedly
// ("tự động đăng xuất"). One shared instance means one refresh manager.
let browserClient: ReturnType<typeof makeBrowserClient> | undefined;

export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = makeBrowserClient();
  }

  return browserClient;
}
