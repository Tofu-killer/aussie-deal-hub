import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  evaluateWorkerRuntimeHealth,
  isWorkerStateRecord,
} from "../packages/config/src/workerRuntimeHealth.ts";

function resolveWorkerStatePath() {
  return process.env.WORKER_STATE_PATH ?? path.join(process.cwd(), ".runtime/worker-state.json");
}

function readPositiveIntegerEnv(name, fallbackValue) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

async function main() {
  const rawState = await readFile(resolveWorkerStatePath(), "utf8");
  const parsedState = JSON.parse(rawState);

  if (!isWorkerStateRecord(parsedState)) {
    throw new Error("Worker state file is not in the expected format.");
  }

  const result = evaluateWorkerRuntimeHealth(parsedState, {
    staleAfterMs: readPositiveIntegerEnv("WORKER_STALE_AFTER_MS", 120000),
  });

  if (!result.ok) {
    throw new Error(`Worker runtime is ${result.status}.`);
  }
}

main().catch((error) => {
  console.error("Worker healthcheck failed:", error);
  process.exitCode = 1;
});
