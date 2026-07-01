import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = requireServerEnv();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
