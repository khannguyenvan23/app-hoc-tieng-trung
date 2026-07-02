"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/login`,
            },
          });

    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage(
        "Hãy kiểm tra email để xác nhận tài khoản, rồi quay lại đăng nhập.",
      );
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10">
      <form
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
        onSubmit={submit}
      >
        <h1 className="text-2xl font-semibold">Hanzi Cards</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Học từ vựng tiếng Trung bằng flashcard và lặp lại ngắt quãng.
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-md border border-zinc-200 p-1 text-sm">
          <button
            className={`rounded px-3 py-2 ${
              mode === "login" ? "bg-teal-700 text-white" : "hover:bg-zinc-100"
            }`}
            onClick={() => setMode("login")}
            type="button"
          >
            Đăng nhập
          </button>
          <button
            className={`rounded px-3 py-2 ${
              mode === "signup" ? "bg-teal-700 text-white" : "hover:bg-zinc-100"
            }`}
            onClick={() => setMode("signup")}
            type="button"
          >
            Đăng ký
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Mật khẩu
        </label>
        <input
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
          id="password"
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}

        <button
          className="mt-6 min-h-11 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading
            ? "Đang xử lý..."
            : mode === "login"
              ? "Đăng nhập"
              : "Tạo tài khoản"}
        </button>
      </form>
    </main>
  );
}
