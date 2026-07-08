"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ActiveDayTracker } from "@/components/active-day-tracker";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const navItems = [
  {
    href: "/study",
    label: "Ôn tập",
    paths: ["/study"],
  },
  {
    href: "/study-sentences",
    label: "Luyện câu",
    paths: ["/study-sentences"],
  },
  {
    href: "/statistics",
    label: "Thống kê",
    paths: ["/statistics"],
  },
  {
    href: "/dashboard",
    label: "Bộ thẻ",
    paths: ["/dashboard", "/decks"],
  },
  {
    href: "/pricing",
    label: "Nạp credit",
    paths: ["/pricing"],
  },
  {
    href: "/options",
    label: "Cài đặt",
    paths: ["/options"],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  function isActivePath(paths: string[]) {
    return paths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }

  function navLinkClass(active: boolean, mobile = false) {
    const base = mobile ? "rounded px-3 py-2" : "rounded-md px-3 py-2";
    return active
      ? `${base} bg-teal-50 font-medium text-teal-800`
      : `${base} hover:bg-zinc-100`;
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-stone-50 text-zinc-950">
      <ActiveDayTracker />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4">
          <Link href="/dashboard" className="font-semibold">
            Tiếng Trung Hihi
          </Link>
          <nav className="hidden items-center gap-2 text-sm sm:flex">
            {navItems.map((item) => {
              const active = isActivePath(item.paths);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={navLinkClass(active)}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 hover:bg-zinc-100"
              onClick={signOut}
              type="button"
            >
              Đăng xuất
            </button>
          </nav>
          <details className="relative sm:hidden">
            <summary className="cursor-pointer list-none rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100">
              Menu
            </summary>
            <nav className="absolute right-0 z-50 mt-2 grid w-48 gap-1 rounded-md border border-zinc-200 bg-white p-2 text-sm shadow-lg">
              {navItems.map((item) => {
                const active = isActivePath(item.paths);

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={navLinkClass(active, true)}
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button
                className="rounded px-3 py-2 text-left hover:bg-zinc-100"
                onClick={signOut}
                type="button"
              >
                Đăng xuất
              </button>
            </nav>
          </details>
        </div>
      </header>
      <main className="mx-auto min-w-0 w-full max-w-6xl px-3 py-5 sm:px-4 sm:py-8">
        {children}
      </main>
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
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center sm:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-zinc-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
  prefetch,
}: {
  href: string;
  children: React.ReactNode;
  prefetch?: boolean;
}) {
  return (
    <Link
      className="inline-flex min-h-10 items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
      href={href}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}
