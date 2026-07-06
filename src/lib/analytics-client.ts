"use client";

const visitorKey = "tth_analytics_visitor_id";
const sessionKey = "tth_analytics_session_id";

function getStoredId(storage: Storage, key: string) {
  const current = storage.getItem(key);

  if (current) {
    return current;
  }

  const next = crypto.randomUUID();
  storage.setItem(key, next);
  return next;
}

export function getAnalyticsIds() {
  return {
    visitorId: getStoredId(window.localStorage, visitorKey),
    sessionId: getStoredId(window.sessionStorage, sessionKey),
  };
}

export function trackPublicAnalyticsEvent(
  eventName: "page_view" | "signup_submitted",
  path = window.location.pathname,
) {
  try {
    const { visitorId, sessionId } = getAnalyticsIds();

    void fetch("/api/analytics", {
      body: JSON.stringify({ eventName, path, sessionId, visitorId }),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // Analytics must never interrupt the user flow.
  }
}
