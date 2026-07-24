const IMMEDIATE_DUE_SKEW_MINUTES = 10;

export function getImmediateDueAt(now = new Date()) {
  return new Date(
    now.getTime() - IMMEDIATE_DUE_SKEW_MINUTES * 60_000,
  ).toISOString();
}
