import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { createDependencyHealthChecker } from "../src/routes/health";
import { dispatchRequest } from "./httpHarness";

describe("health endpoint", () => {
  it("returns 200 when no liveness or readiness checker is configured", async () => {
    const app = buildApp();

    const healthResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/health",
    });
    const readyResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/ready",
    });

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ ok: true });
    expect(readyResponse.status).toBe(200);
    expect(readyResponse.body).toEqual({ ok: true });
  });

  it("returns 503 JSON on /ready when a dependency is unavailable", async () => {
    const app = buildApp({
      readyCheck: async () => ({
        ok: false,
        dependencies: {
          db: "unavailable",
        },
      }),
    });

    const healthResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/health",
    });
    const readyResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/ready",
    });

    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ ok: true });
    expect(readyResponse.status).toBe(503);
    expect(readyResponse.body).toEqual({
      ok: false,
      dependencies: {
        db: "unavailable",
      },
    });
  });

  it("builds a dependency health checker that reports the failing dependency key", async () => {
    const healthCheck = createDependencyHealthChecker({
      db: async () => {},
      dbPublishingSchema: async () => {
        throw new Error("relation missing");
      },
    });

    await expect(healthCheck()).resolves.toEqual({
      ok: false,
      dependencies: {
        dbPublishingSchema: "unavailable",
      },
    });
  });

  it("reports multiple failing dependency groups without hiding the specific readiness buckets", async () => {
    const healthCheck = createDependencyHealthChecker({
      db: async () => {},
      dbCatalogSchema: async () => {
        throw new Error("catalog relation missing");
      },
      dbPublishingSchema: async () => {
        throw new Error("publishing relation missing");
      },
    });

    await expect(healthCheck()).resolves.toEqual({
      ok: false,
      dependencies: {
        dbCatalogSchema: "unavailable",
        dbPublishingSchema: "unavailable",
      },
    });
  });
});
