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
  return Boolean(value) && typeof value === "object";
}

export function isWorkerStateRecord(value: unknown): value is WorkerStateRecord {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.status === "string" && typeof value.serviceStartedAt === "string";
}

export function evaluateWorkerRuntimeHealth(
  state: WorkerStateRecord,
  options: WorkerRuntimeHealthOptions = {},
): WorkerRuntimeHealthResult {
  const staleAfterMs = options.staleAfterMs ?? 120_000;
  const now = options.now ?? Date.now();
  const lastTimestamp = state.lastCompletedAt ?? state.lastAttemptedAt;
  const ageMs = lastTimestamp ? Math.max(now - Date.parse(lastTimestamp), 0) : null;
  const startupAgeMs = Math.max(now - Date.parse(state.serviceStartedAt), 0);
  const isStarting =
    state.status === "idle" &&
    ageMs === null &&
    !Number.isNaN(startupAgeMs) &&
    startupAgeMs <= staleAfterMs;
  const isStale = ageMs === null || Number.isNaN(ageMs) || ageMs > staleAfterMs;
  const isError = state.status === "error";

  return {
    ok: !isError && (isStarting || !isStale),
    status: isError ? "error" : isStarting ? "starting" : isStale ? "stale" : "ok",
    ageMs,
  };
}
