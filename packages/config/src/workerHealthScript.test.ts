import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/check-worker-health.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.WORKER_STATE_PATH;
  delete process.env.WORKER_STALE_AFTER_MS;

  await Promise.all(
    tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

async function writeWorkerStateFile(body: unknown) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "adh-worker-health-"));
  const statePath = path.join(tempDir, "worker-state.json");

  tempDirs.push(tempDir);
  await writeFile(statePath, JSON.stringify(body));

  return statePath;
}

function runWorkerHealthScript(statePath: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      WORKER_STATE_PATH: statePath,
      ...env,
    },
    encoding: "utf8",
  });
}

describe("worker healthcheck script", () => {
  it("accepts a worker that is still inside the startup grace window", async () => {
    const statePath = await writeWorkerStateFile({
      serviceStartedAt: new Date().toISOString(),
      status: "idle",
      lastAttemptedAt: null,
      lastCompletedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });

    const result = runWorkerHealthScript(statePath, {
      WORKER_STALE_AFTER_MS: "60000",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("fails when the worker state file contains an unsupported status", async () => {
    const now = new Date().toISOString();
    const statePath = await writeWorkerStateFile({
      serviceStartedAt: now,
      status: "booting",
      lastAttemptedAt: now,
      lastCompletedAt: now,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });

    const result = runWorkerHealthScript(statePath, {
      WORKER_STALE_AFTER_MS: "60000",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Worker state file is not in the expected format.");
  });

  it("fails once an idle worker outlives its startup grace window without a heartbeat", async () => {
    const statePath = await writeWorkerStateFile({
      serviceStartedAt: "2026-04-20T00:00:00.000Z",
      status: "idle",
      lastAttemptedAt: null,
      lastCompletedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });

    const result = runWorkerHealthScript(statePath, {
      WORKER_STALE_AFTER_MS: "1000",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Worker runtime is stale.");
  });

  it("fails when the worker has attempts but no completed pass yet", async () => {
    const statePath = await writeWorkerStateFile({
      serviceStartedAt: "2026-04-20T00:00:00.000Z",
      status: "idle",
      lastAttemptedAt: new Date().toISOString(),
      lastCompletedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });

    const result = runWorkerHealthScript(statePath, {
      WORKER_STALE_AFTER_MS: "60000",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Worker runtime is stale.");
  });
});
