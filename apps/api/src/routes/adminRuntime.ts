import { readFile } from "node:fs/promises";
import path from "node:path";

import { Router } from "express";

interface WorkerStateSummary {
  publishedCount: number;
  publishedLeadIds: string[];
  queuedPublishCount: number;
  queuedReviewCount: number;
  reviewedCount: number;
  reviewedLeadIds: string[];
  skippedPublishCount: number;
}

interface WorkerStateRecord {
  lastAttemptedAt: string | null;
  lastCompletedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastSummary: WorkerStateSummary | null;
  serviceStartedAt: string;
  status: "error" | "idle" | "ok";
}

function resolveWorkerStatePath() {
  return process.env.WORKER_STATE_PATH ?? path.join(process.cwd(), ".runtime/worker-state.json");
}

function readPositiveIntegerEnv(name: string, fallbackValue: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isWorkerStateRecord(value: unknown): value is WorkerStateRecord {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.status === "string" && typeof value.serviceStartedAt === "string";
}

function buildMissingWorkerStateResponse() {
  return {
    ok: false,
    status: "missing" as const,
    message: "Worker state unavailable.",
  };
}

export function createAdminRuntimeRouter() {
  const router = Router();

  router.get("/runtime/worker", async (_request, response) => {
    let rawState: string;

    try {
      rawState = await readFile(resolveWorkerStatePath(), "utf8");
    } catch {
      response.status(503).json(buildMissingWorkerStateResponse());
      return;
    }

    let state: WorkerStateRecord;

    try {
      const parsed = JSON.parse(rawState);

      if (!isWorkerStateRecord(parsed)) {
        response.status(503).json(buildMissingWorkerStateResponse());
        return;
      }

      state = parsed;
    } catch {
      response.status(503).json(buildMissingWorkerStateResponse());
      return;
    }

    const staleAfterMs = readPositiveIntegerEnv("WORKER_STALE_AFTER_MS", 120000);
    const lastTimestamp = state.lastCompletedAt ?? state.lastAttemptedAt;
    const ageMs = lastTimestamp ? Math.max(Date.now() - Date.parse(lastTimestamp), 0) : null;
    const isStale = ageMs === null || Number.isNaN(ageMs) || ageMs > staleAfterMs;
    const isError = state.status === "error";
    const ok = !isError && !isStale;

    response.status(ok ? 200 : 503).json({
      ok,
      status: isError ? "error" : isStale ? "stale" : "ok",
      ageMs,
      serviceStartedAt: state.serviceStartedAt,
      lastAttemptedAt: state.lastAttemptedAt,
      lastCompletedAt: state.lastCompletedAt,
      lastErrorAt: state.lastErrorAt,
      lastErrorMessage: state.lastErrorMessage,
      lastSummary: state.lastSummary,
    });
  });

  return router;
}
