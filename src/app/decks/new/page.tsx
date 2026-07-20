"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "@/components/auth-guard";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function NewDeckPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("decks")
      .insert({ name, user_id: user.id })
      .select("id")
      .single();

    setLoading(false);

    if (insertError || !data) {
      setError(insertError?.message || "Không thể tạo bộ thẻ");
      return;
    }

    router.push(`/decks/${data.id}`);
  }

  return (
    <AuthGuard>
      <AppShell>
        <form className="max-w-lg" onSubmit={submit}>
          <h1 className="text-2xl font-semibold">Tạo bộ thẻ</h1>
          <label className="mt-6 block text-sm font-medium" htmlFor="name">
            Tên bộ thẻ
          </label>
          <input
            className="mt-2 w-full rounded-md border border-zinc-300 dark:border-white/15 px-3 py-2 outline-none focus:border-teal-700"
            id="name"
            onChange={(event) => setName(event.target.value)}
            placeholder="HSK2, Ăn uống, Giao tiếp..."
            required
            value={name}
          />
          {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
          <button
            className="mt-5 min-h-10 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "Đang tạo..." : "Tạo bộ thẻ"}
          </button>
        </form>
      </AppShell>
    </AuthGuard>
  );
}
