import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

let tempDir: string | null = null;

afterEach(async () => {
  delete process.env.WORKER_STATE_PATH;
  delete process.env.WORKER_STALE_AFTER_MS;

  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

async function writeWorkerStateFile(body: unknown) {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "adh-worker-state-"));
  const statePath = path.join(tempDir, "worker-state.json");
  process.env.WORKER_STATE_PATH = statePath;
  await writeFile(statePath, JSON.stringify(body));
}

describe("admin runtime routes", () => {
  it("returns 503 when the worker state file is missing", async () => {
    process.env.WORKER_STATE_PATH = path.join(os.tmpdir(), "missing-worker-state.json");
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      status: "missing",
      message: "Worker state unavailable.",
    });
  });

  it("returns 200 for a fresh worker heartbeat", async () => {
    await writeWorkerStateFile({
      serviceStartedAt: "2026-04-24T00:00:00.000Z",
      status: "ok",
      lastAttemptedAt: new Date().toISOString(),
      lastCompletedAt: new Date().toISOString(),
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: {
        reviewedCount: 1,
        publishedCount: 2,
        queuedReviewCount: 1,
        queuedPublishCount: 2,
        skippedPublishCount: 0,
        reviewedLeadIds: ["lead_1"],
        publishedLeadIds: ["lead_2", "lead_3"],
      },
    });
    process.env.WORKER_STALE_AFTER_MS = "60000";
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      status: "ok",
      lastSummary: {
        reviewedCount: 1,
        publishedCount: 2,
      },
    });
  });

  it("returns 503 when the worker state file contains an unsupported status", async () => {
    const now = new Date().toISOString();
    await writeWorkerStateFile({
      serviceStartedAt: now,
      status: "booting",
      lastAttemptedAt: now,
      lastCompletedAt: now,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });
    process.env.WORKER_STALE_AFTER_MS = "60000";
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      status: "missing",
      message: "Worker state unavailable.",
    });
  });

  it("returns 200 while the worker is still in its startup window", async () => {
    await writeWorkerStateFile({
      serviceStartedAt: new Date().toISOString(),
      status: "idle",
      lastAttemptedAt: null,
      lastCompletedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });
    process.env.WORKER_STALE_AFTER_MS = "60000";
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      status: "starting",
      ageMs: null,
    });
  });

  it("returns 503 once the startup grace window expires without a first heartbeat", async () => {
    await writeWorkerStateFile({
      serviceStartedAt: "2026-04-20T00:00:00.000Z",
      status: "idle",
      lastAttemptedAt: null,
      lastCompletedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });
    process.env.WORKER_STALE_AFTER_MS = "1000";
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ok: false,
      status: "stale",
      ageMs: null,
    });
  });

  it("returns 503 until the worker completes its first pass", async () => {
    await writeWorkerStateFile({
      serviceStartedAt: "2026-04-24T00:00:00.000Z",
      status: "idle",
      lastAttemptedAt: new Date().toISOString(),
      lastCompletedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: null,
    });
    process.env.WORKER_STALE_AFTER_MS = "60000";
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ok: false,
      status: "stale",
      ageMs: null,
      lastCompletedAt: null,
    });
  });

  it("returns 503 for a stale worker heartbeat", async () => {
    await writeWorkerStateFile({
      serviceStartedAt: "2026-04-24T00:00:00.000Z",
      status: "ok",
      lastAttemptedAt: "2026-04-20T00:00:00.000Z",
      lastCompletedAt: "2026-04-20T00:00:00.000Z",
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: {
        reviewedCount: 0,
        publishedCount: 0,
        queuedReviewCount: 0,
        queuedPublishCount: 0,
        skippedPublishCount: 0,
        reviewedLeadIds: [],
        publishedLeadIds: [],
      },
    });
    process.env.WORKER_STALE_AFTER_MS = "1000";
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/runtime/worker",
    });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ok: false,
      status: "stale",
    });
  });
});
