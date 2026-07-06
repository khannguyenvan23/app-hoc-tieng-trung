import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bộ thẻ được chia sẻ",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SharedDeckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
