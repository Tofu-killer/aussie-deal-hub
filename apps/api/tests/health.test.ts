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
          dbConnectivity: "unavailable",
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
        dbConnectivity: "unavailable",
      },
    });
  });

  it("returns a safe top-level error code when the readiness checker itself throws", async () => {
    const app = buildApp({
      readyCheck: async () => {
        throw new Error("boom");
      },
    });

    const readyResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/ready",
    });

    expect(readyResponse.status).toBe(503);
    expect(readyResponse.body).toEqual({
      ok: false,
      error: "health_check_failed",
    });
  });

  it("builds a dependency health checker that reports the failing dependency key", async () => {
    const healthCheck = createDependencyHealthChecker({
      dbConnectivity: async () => {},
      dbPublishingSchema: async () => {
        throw new Error("relation missing");
      },
    });

    await expect(healthCheck()).resolves.toEqual({
      ok: false,
      dependencies: {
        dbPublishingSchema: "schema_mismatch",
      },
    });
  });

  it("reports multiple failing dependency groups without hiding the specific readiness buckets", async () => {
    const healthCheck = createDependencyHealthChecker({
      dbConnectivity: async () => {},
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
        dbCatalogSchema: "schema_mismatch",
        dbPublishingSchema: "schema_mismatch",
      },
    });
  });

  it("keeps dependency failures coarse but distinguishes connection and timeout issues", async () => {
    const healthCheck = createDependencyHealthChecker({
      dbConnectivity: async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
      },
      redis: async () => {
        throw new Error("Redis health check timed out.");
      },
      email: async () => {
        throw new Error("password authentication failed for user deploy");
      },
    });

    await expect(healthCheck()).resolves.toEqual({
      ok: false,
      dependencies: {
        dbConnectivity: "connection_failed",
        redis: "timeout",
        email: "authentication_failed",
      },
    });
  });
});
