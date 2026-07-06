"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackPublicAnalyticsEvent } from "@/lib/analytics-client";

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    trackPublicAnalyticsEvent("page_view", pathname);
  }, [pathname]);

  return null;
}
