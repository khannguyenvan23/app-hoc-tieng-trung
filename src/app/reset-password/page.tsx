"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function cleanResetUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

function getResetParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return {
    accessToken: hashParams.get("access_token"),
    code: searchParams.get("code"),
    refreshToken: hashParams.get("refresh_token"),
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type") || hashParams.get("type"),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [canUpdatePassword, setCanUpdatePassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function prepareRecoverySession() {
      setCheckingSession(true);
      setMessage("Đang kiểm tra link đặt lại mật khẩu...");
      setIsError(false);

      const { accessToken, code, refreshToken, tokenHash, type } = getResetParams();

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!active) {
          return;
        }

        if (!error) {
          cleanResetUrl();
          setCanUpdatePassword(true);
          setMessage("");
          setCheckingSession(false);
          return;
        }
      }

      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (!active) {
          return;
        }

        if (!error) {
          cleanResetUrl();
          setCanUpdatePassword(true);
          setMessage("");
          setCheckingSession(false);
          return;
        }
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!active) {
          return;
        }

        if (!error) {
          cleanResetUrl();
          setCanUpdatePassword(true);
          setMessage("");
          setCheckingSession(false);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (data.session) {
        setCanUpdatePassword(true);
        setMessage("");
      } else {
        setCanUpdatePassword(false);
        setIsError(true);
        setMessage(
          "Link đặt lại mật khẩu đã hết hạn hoặc không tạo được phiên đăng nhập. Hãy quay lại trang đăng nhập và gửi lại email đặt mật khẩu.",
        );
      }

      setCheckingSession(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setCanUpdatePassword(true);
        setMessage("");
        setIsError(false);
        setCheckingSession(false);
      }
    });

    void prepareRecoverySession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (!canUpdatePassword) {
      setIsError(true);
      setMessage("Link đặt lại mật khẩu chưa sẵn sàng. Hãy gửi lại email đặt mật khẩu.");
      return;
    }

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
      setMessage(
        result.error.message === "Auth session missing!"
          ? "Link đặt lại mật khẩu đã hết hạn. Hãy gửi lại email đặt mật khẩu."
          : result.error.message,
      );
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
          disabled={checkingSession || !canUpdatePassword}
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
          disabled={checkingSession || !canUpdatePassword}
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
          disabled={checkingSession || loading || !canUpdatePassword}
          type="submit"
        >
          {checkingSession
            ? "Đang kiểm tra link..."
            : loading
              ? "Đang lưu..."
              : "Đổi mật khẩu"}
        </button>

        {!checkingSession && !canUpdatePassword ? (
          <button
            className="mt-4 w-full text-sm font-medium text-teal-800 hover:underline"
            onClick={() => router.push("/login")}
            type="button"
          >
            Quay lại đăng nhập
          </button>
        ) : null}
      </form>
    </main>
  );
}
