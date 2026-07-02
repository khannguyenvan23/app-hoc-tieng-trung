"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("Hai mật khẩu chưa khớp.");
      return;
    }

    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const result = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
      return;
    }

    setMessage("Đã đổi mật khẩu. Bạn có thể đăng nhập lại.");
    setTimeout(() => router.push("/login"), 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-4 py-10">
      <form
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
        onSubmit={submit}
      >
        <h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Nhập mật khẩu mới cho tài khoản Hanzi Cards.
        </p>

        <label className="mt-5 block text-sm font-medium" htmlFor="password">
          Mật khẩu mới
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

        <label
          className="mt-4 block text-sm font-medium"
          htmlFor="confirm-password"
        >
          Nhập lại mật khẩu mới
        </label>
        <input
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-teal-700"
          id="confirm-password"
          minLength={6}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />

        {message ? (
          <p
            className={`mt-4 text-sm ${
              isError ? "text-red-700" : "text-teal-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        <button
          className="mt-6 min-h-11 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading ? "Đang lưu..." : "Đổi mật khẩu"}
        </button>
      </form>
    </main>
  );
}
