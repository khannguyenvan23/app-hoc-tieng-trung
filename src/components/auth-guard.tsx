"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasPublicEnv } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const configured = hasPublicEnv();

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setReady(true);
    });
  }, [configured, router]);

  if (!configured) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-white/5 px-4 py-10 text-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-2xl rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Supabase is not configured
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Add your env variables</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Create <code className="rounded bg-zinc-100 dark:bg-white/10 px-1">.env.local</code>{" "}
            from <code className="rounded bg-zinc-100 dark:bg-white/10 px-1">.env.example</code>,
            then fill these values and restart the dev server.
          </p>
          <pre className="mt-5 overflow-x-auto rounded-lg bg-zinc-950 p-4 text-sm text-zinc-50">
            {`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=`}
          </pre>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-white/5 px-4 py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Loading...
      </div>
    );
  }

  return children;
}
