"use client";

import { useEffect } from "react";
import { fetchWithAuth } from "@/lib/fetch-auth";

export function ActiveDayTracker() {
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA");
    const storageKey = `tth_active_day_${today}`;

    if (window.sessionStorage.getItem(storageKey)) {
      return;
    }

    window.sessionStorage.setItem(storageKey, "pending");
    fetchWithAuth("/api/analytics", {
      body: JSON.stringify({ eventName: "daily_active" }),
      method: "POST",
    })
      .then((response) => {
        if (!response.ok) {
          window.sessionStorage.removeItem(storageKey);
          return;
        }

        window.sessionStorage.setItem(storageKey, "recorded");
      })
      .catch(() => window.sessionStorage.removeItem(storageKey));
  }, []);

  return null;
}
