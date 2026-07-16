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
    href: "/community",
    label: "Cộng đồng",
    paths: ["/community"],
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
    const base = mobile ? "rounded-lg px-3 py-2" : "rounded-lg px-3 py-2";
    return active
      ? `${base} bg-teal-50 font-semibold text-teal-800 shadow-sm`
      : `${base} text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950`;
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="app-bg min-h-screen overflow-x-clip text-zinc-950">
      <ActiveDayTracker />
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Tiếng Trung Hihi
          </Link>
          <nav className="hidden items-center gap-1 rounded-xl border border-zinc-200 bg-white/80 p-1 text-sm shadow-sm sm:flex">
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
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-medium hover:bg-zinc-100"
              onClick={signOut}
              type="button"
            >
              Đăng xuất
            </button>
          </nav>
          <details className="relative sm:hidden">
            <summary className="cursor-pointer list-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-zinc-100">
              Menu
            </summary>
            <nav className="absolute right-0 z-50 mt-2 grid w-52 gap-1 rounded-xl border border-zinc-200 bg-white p-2 text-sm shadow-xl">
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
                className="rounded-lg px-3 py-2 text-left font-medium hover:bg-zinc-100"
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
    <div className="app-surface rounded-xl border-dashed p-6 text-center sm:p-8">
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
      className="btn-primary inline-flex items-center justify-center px-4 py-2 text-sm"
      href={href}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}
