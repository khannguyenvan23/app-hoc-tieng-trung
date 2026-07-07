import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const configuredTraceRate = Number(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
);

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate:
    Number.isFinite(configuredTraceRate) &&
    configuredTraceRate >= 0 &&
    configuredTraceRate <= 1
      ? configuredTraceRate
      : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
