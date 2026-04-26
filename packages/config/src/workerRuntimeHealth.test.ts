import { describe, expect, it } from "vitest";

import {
  evaluateWorkerRuntimeHealth,
  isWorkerStateRecord,
  type WorkerStateRecord,
} from "./workerRuntimeHealth";

function createState(overrides: Partial<WorkerStateRecord> = {}): WorkerStateRecord {
  return {
    serviceStartedAt: "2026-04-27T00:00:00.000Z",
    status: "ok",
    lastAttemptedAt: "2026-04-27T00:00:05.000Z",
    lastCompletedAt: "2026-04-27T00:00:10.000Z",
    lastErrorAt: null,
    lastErrorMessage: null,
    lastSummary: null,
    ...overrides,
  };
}

describe("worker runtime health", () => {
  it("accepts the stored worker state shape", () => {
    expect(isWorkerStateRecord(createState())).toBe(true);
    expect(isWorkerStateRecord({ status: "ok" })).toBe(false);
  });

  it("rejects malformed worker state records", () => {
    expect(isWorkerStateRecord({ ...createState(), status: "booting" })).toBe(false);
    expect(isWorkerStateRecord({ ...createState(), lastCompletedAt: "not-a-date" })).toBe(false);
    expect(isWorkerStateRecord({ ...createState(), lastErrorMessage: 42 })).toBe(false);
    expect(isWorkerStateRecord({ ...createState(), lastSummary: [] })).toBe(false);
  });

  it("treats a fresh completed heartbeat as healthy", () => {
    const result = evaluateWorkerRuntimeHealth(createState(), {
      now: Date.parse("2026-04-27T00:00:20.000Z"),
      staleAfterMs: 60_000,
    });

    expect(result).toEqual({
      ok: true,
      status: "ok",
      ageMs: 10_000,
    });
  });

  it("treats a just-started worker with no completed pass as healthy", () => {
    const result = evaluateWorkerRuntimeHealth(
      createState({
        status: "idle",
        lastAttemptedAt: null,
        lastCompletedAt: null,
      }),
      {
        now: Date.parse("2026-04-27T00:00:20.000Z"),
        staleAfterMs: 60_000,
      },
    );

    expect(result).toEqual({
      ok: true,
      status: "starting",
      ageMs: null,
    });
  });

  it("treats a worker that never reaches its first pass as stale after the startup grace window", () => {
    const result = evaluateWorkerRuntimeHealth(
      createState({
        status: "idle",
        lastAttemptedAt: null,
        lastCompletedAt: null,
      }),
      {
        now: Date.parse("2026-04-27T00:01:10.000Z"),
        staleAfterMs: 60_000,
      },
    );

    expect(result).toEqual({
      ok: false,
      status: "stale",
      ageMs: null,
    });
  });

  it("treats a fresh error state as unhealthy", () => {
    const result = evaluateWorkerRuntimeHealth(
      createState({
        status: "error",
        lastErrorAt: "2026-04-27T00:00:15.000Z",
        lastErrorMessage: "SMTP down",
      }),
      {
        now: Date.parse("2026-04-27T00:00:20.000Z"),
        staleAfterMs: 60_000,
      },
    );

    expect(result).toEqual({
      ok: false,
      status: "error",
      ageMs: 10_000,
    });
  });
});
