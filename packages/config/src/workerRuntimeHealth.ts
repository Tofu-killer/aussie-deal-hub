export interface WorkerStateSummary {
  [key: string]: unknown;
}

export interface WorkerStateRecord {
  lastAttemptedAt: string | null;
  lastCompletedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastSummary: WorkerStateSummary | null;
  serviceStartedAt: string;
  status: "error" | "idle" | "ok";
}

export interface WorkerRuntimeHealthResult {
  ageMs: number | null;
  ok: boolean;
  status: "error" | "ok" | "starting" | "stale";
}

interface WorkerRuntimeHealthOptions {
  now?: number;
  staleAfterMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWorkerStatus(value: unknown): value is WorkerStateRecord["status"] {
  return value === "error" || value === "idle" || value === "ok";
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function isWorkerStateRecord(value: unknown): value is WorkerStateRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isWorkerStatus(value.status) &&
    isTimestamp(value.serviceStartedAt) &&
    isNullableTimestamp(value.lastAttemptedAt) &&
    isNullableTimestamp(value.lastCompletedAt) &&
    isNullableTimestamp(value.lastErrorAt) &&
    isNullableString(value.lastErrorMessage) &&
    (value.lastSummary === null || isRecord(value.lastSummary))
  );
}

export function evaluateWorkerRuntimeHealth(
  state: WorkerStateRecord,
  options: WorkerRuntimeHealthOptions = {},
): WorkerRuntimeHealthResult {
  const staleAfterMs = options.staleAfterMs ?? 120_000;
  const now = options.now ?? Date.now();
  const lastCompletedAgeMs = state.lastCompletedAt
    ? Math.max(now - Date.parse(state.lastCompletedAt), 0)
    : null;
  const startupAgeMs = Math.max(now - Date.parse(state.serviceStartedAt), 0);
  const isStarting =
    state.status === "idle" &&
    state.lastAttemptedAt === null &&
    state.lastCompletedAt === null &&
    !Number.isNaN(startupAgeMs) &&
    startupAgeMs <= staleAfterMs;
  const isStale =
    lastCompletedAgeMs === null ||
    Number.isNaN(lastCompletedAgeMs) ||
    lastCompletedAgeMs > staleAfterMs;
  const isError = state.status === "error";

  return {
    ok: !isError && (isStarting || !isStale),
    status: isError ? "error" : isStarting ? "starting" : isStale ? "stale" : "ok",
    ageMs: lastCompletedAgeMs,
  };
}
