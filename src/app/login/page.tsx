"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  createSupabaseBrowserClient,
  createSupabasePasswordResetClient,
} from "@/lib/supabase/browser";

type AuthMode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setConfirmPassword("");
    setMessage("");
    setIsError(false);
    setCanResendConfirmation(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsError(false);
    setCanResendConfirmation(false);

    if (mode === "signup" && password !== confirmPassword) {
      setIsError(true);
      setMessage("Hai mật khẩu chưa khớp.");
      return;
    }

    setLoading(true);

    if (mode === "forgot") {
      const supabase = createSupabasePasswordResetClient();
      const result = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      setLoading(false);

      if (result.error) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(
        "Đã gửi email đặt lại mật khẩu. Hãy kiểm tra Inbox, Spam và Promotions.",
      );
      return;
    }

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
      setIsError(true);
      setMessage(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage(
        "Hãy kiểm tra email để xác nhận tài khoản, rồi quay lại đăng nhập.",
      );
      setCanResendConfirmation(true);
      return;
    }

    router.push("/dashboard");
  }

  async function resendConfirmation() {
    setLoading(true);
    setMessage("");
    setIsError(false);

    const supabase = createSupabaseBrowserClient();
    const result = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    setLoading(false);

    if (result.error) {
      setIsError(true);
      setMessage(result.error.message);
      return;
    }

    setMessage("Đã gửi lại email xác nhận. Hãy kiểm tra Inbox, Spam và Promotions.");
    setCanResendConfirmation(true);
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
            onClick={() => changeMode("login")}
            type="button"
          >
            Đăng nhập
          </button>
          <button
            className={`rounded px-3 py-2 ${
              mode === "signup" ? "bg-teal-700 text-white" : "hover:bg-zinc-100"
            }`}
            onClick={() => changeMode("signup")}
            type="button"
          >
            Đăng ký
          </button>
        </div>

        {mode === "forgot" ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Nhập email tài khoản. App sẽ gửi link để bạn tạo mật khẩu mới.
          </div>
        ) : null}

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

        {mode !== "forgot" ? (
          <>
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
          </>
        ) : null}

        {mode === "signup" ? (
          <>
            <label
              className="mt-4 block text-sm font-medium"
              htmlFor="confirm-password"
            >
              Nhập lại mật khẩu
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
          </>
        ) : null}

        {message ? (
          <p
            className={`mt-4 text-sm ${
              isError ? "text-red-700" : "text-teal-700"
            }`}
          >
            {message}
          </p>
        ) : null}

        {canResendConfirmation ? (
          <button
            className="mt-3 min-h-10 w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60"
            disabled={loading || !email}
            onClick={resendConfirmation}
            type="button"
          >
            Gửi lại email xác nhận
          </button>
        ) : null}

        <button
          className="mt-6 min-h-11 w-full rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading
            ? "Đang xử lý..."
            : mode === "login"
              ? "Đăng nhập"
              : mode === "signup"
                ? "Tạo tài khoản"
                : "Gửi email đặt lại mật khẩu"}
        </button>

        {mode === "login" ? (
          <button
            className="mt-4 w-full text-sm font-medium text-teal-800 hover:underline"
            onClick={() => changeMode("forgot")}
            type="button"
          >
            Quên mật khẩu?
          </button>
        ) : null}

        {mode === "forgot" ? (
          <button
            className="mt-4 w-full text-sm font-medium text-teal-800 hover:underline"
            onClick={() => changeMode("login")}
            type="button"
          >
            Quay lại đăng nhập
          </button>
        ) : null}

        <p className="mt-6 text-center text-xs leading-5 text-zinc-500">
          Khi sử dụng Hanzi Cards, bạn đồng ý với{" "}
          <Link className="font-medium text-teal-800 hover:underline" href="/terms">
            Điều khoản sử dụng
          </Link>{" "}
          và{" "}
          <Link className="font-medium text-teal-800 hover:underline" href="/privacy">
            Chính sách bảo mật
          </Link>
          .
        </p>
      </form>
    </main>
  );
}
