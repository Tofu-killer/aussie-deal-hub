import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { createDependencyHealthChecker } from "../src/routes/health";
import { dispatchRequest } from "./httpHarness";

describe("health endpoint", () => {
  it("returns 200 when no health checker is configured", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/health",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("returns 503 JSON when a dependency is unavailable", async () => {
    const app = buildApp({
      healthCheck: async () => ({
        ok: false,
        dependencies: {
          db: "unavailable",
        },
      }),
    });

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/health",
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      dependencies: {
        db: "unavailable",
      },
    });
  });

  it("builds a dependency health checker that reports the failing dependency key", async () => {
    const healthCheck = createDependencyHealthChecker({
      db: async () => {},
      dbSchema: async () => {
        throw new Error("relation missing");
      },
    });

    await expect(healthCheck()).resolves.toEqual({
      ok: false,
      dependencies: {
        dbSchema: "unavailable",
      },
    });
  });
});
