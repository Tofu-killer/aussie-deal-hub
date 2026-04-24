import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WorkerCycleSummary } from "./runtime";

export interface WorkerStateRecord {
  lastAttemptedAt: string | null;
  lastCompletedAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastSummary: WorkerCycleSummary | null;
  serviceStartedAt: string;
  status: "error" | "idle" | "ok";
}

export function resolveWorkerStatePath() {
  return process.env.WORKER_STATE_PATH ?? path.join(process.cwd(), ".runtime/worker-state.json");
}

export async function writeWorkerState(state: WorkerStateRecord) {
  const statePath = resolveWorkerStatePath();

  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2));
}
