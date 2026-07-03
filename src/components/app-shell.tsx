"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="font-semibold">
            Hanzi Cards
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link className="rounded-md px-3 py-2 hover:bg-zinc-100" href="/study">
              Ôn tập
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-zinc-100"
              href="/study-sentences"
            >
              Luyện câu
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-zinc-100"
              href="/dashboard"
            >
              Bộ thẻ
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-zinc-100"
              href="/pricing"
            >
              Nạp credit
            </Link>
            <Link
              className="rounded-md px-3 py-2 hover:bg-zinc-100"
              href="/options"
            >
              Cài đặt
            </Link>
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-100"
              onClick={signOut}
              type="button"
            >
              Đăng xuất
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      href={href}
    >
      {children}
    </Link>
  );
}
