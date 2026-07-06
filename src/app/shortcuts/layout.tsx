import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hướng dẫn phím tắt",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ShortcutsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
