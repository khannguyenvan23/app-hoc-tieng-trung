"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requirePublicEnv } from "@/lib/env";

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = requirePublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
