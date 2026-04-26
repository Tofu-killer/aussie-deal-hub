import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  evaluateWorkerRuntimeHealth,
  isWorkerStateRecord,
  type WorkerStateRecord,
} from "../../../../packages/config/src/workerRuntimeHealth.ts";
import { Router } from "express";

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
    const runtimeHealth = evaluateWorkerRuntimeHealth(state, {
      staleAfterMs,
    });

    response.status(runtimeHealth.ok ? 200 : 503).json({
      ok: runtimeHealth.ok,
      status: runtimeHealth.status,
      ageMs: runtimeHealth.ageMs,
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
