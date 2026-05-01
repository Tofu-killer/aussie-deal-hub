import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/smoke-readiness.mjs");

afterEach(() => {
  delete process.env.API_HEALTH_URL;
  delete process.env.API_READY_URL;
  delete process.env.WEB_HEALTH_URL;
  delete process.env.WEB_READY_URL;
  delete process.env.ADMIN_HEALTH_URL;
  delete process.env.ADMIN_READY_URL;
  delete process.env.WORKER_RUNTIME_URL;
  delete process.env.READINESS_SMOKE_MAX_ATTEMPTS;
  delete process.env.READINESS_SMOKE_DELAY_MS;
});

function runReadinessSmokeScript(env: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
}

describe("readiness smoke script", () => {
  it("does not execute the smoke run when the script is imported as a module", async () => {
    const originalExitCode = process.exitCode;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.exitCode = undefined;

    try {
      const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?import-only`)) as {
        buildReadinessSmokeTargets?: (env: Record<string, string | undefined>) => unknown[];
        buildReadinessSmokeOptions?: (env: Record<string, string | undefined>) => unknown;
        runReadinessSmokeScript?: (
          env: Record<string, string | undefined>,
          runner?: (targets: unknown[], options: unknown) => Promise<void>,
        ) => Promise<void>;
      };

      expect(typeof scriptModule.buildReadinessSmokeTargets).toBe("function");
      expect(typeof scriptModule.buildReadinessSmokeOptions).toBe("function");
      expect(typeof scriptModule.runReadinessSmokeScript).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("accepts healthy readiness targets once every endpoint returns 200", () => {
    const healthyPayload = "data:application/json,%7B%22ok%22%3Atrue%7D";
    const healthyWorkerPayload =
      "data:application/json,%7B%22ok%22%3Atrue%2C%22status%22%3A%22ok%22%7D";
    const result = runReadinessSmokeScript({
      API_HEALTH_URL: healthyPayload,
      API_READY_URL: healthyPayload,
      WEB_HEALTH_URL: healthyPayload,
      WEB_READY_URL: healthyPayload,
      ADMIN_HEALTH_URL: healthyPayload,
      ADMIN_READY_URL: healthyPayload,
      WORKER_RUNTIME_URL: healthyWorkerPayload,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("passes the configured readiness targets to the injected runner", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?runner-test`)) as {
      buildReadinessSmokeTargets?: (env: Record<string, string | undefined>) => unknown[];
      buildReadinessSmokeOptions?: (env: Record<string, string | undefined>) => unknown;
      runReadinessSmokeScript?: (
        env: Record<string, string | undefined>,
        runner?: (targets: unknown[], options: unknown) => Promise<void>,
      ) => Promise<void>;
    };
    const runner = vi.fn(async () => undefined);

    expect(typeof scriptModule.buildReadinessSmokeTargets).toBe("function");
    expect(typeof scriptModule.buildReadinessSmokeOptions).toBe("function");
    expect(typeof scriptModule.runReadinessSmokeScript).toBe("function");

    await scriptModule.runReadinessSmokeScript?.(
      {
        API_HEALTH_URL: "https://api.example.test/v1/health",
        API_READY_URL: "https://api.example.test/v1/ready",
        WEB_HEALTH_URL: "https://www.example.test/health",
        WEB_READY_URL: "https://www.example.test/ready",
        ADMIN_HEALTH_URL: "https://admin.example.test/health",
        ADMIN_READY_URL: "https://admin.example.test/ready",
        WORKER_RUNTIME_URL: "https://api.example.test/v1/admin/runtime/worker",
        READINESS_SMOKE_MAX_ATTEMPTS: "3",
        READINESS_SMOKE_DELAY_MS: "250",
      },
      runner,
    );

    expect(runner).toHaveBeenCalledWith([
      {
        name: "api-health",
        url: "https://api.example.test/v1/health",
        expectedStatus: 200,
        expectedOk: true,
      },
      {
        name: "api-ready",
        url: "https://api.example.test/v1/ready",
        expectedStatus: 200,
        expectedOk: true,
      },
      {
        name: "web-health",
        url: "https://www.example.test/health",
        expectedStatus: 200,
        expectedOk: true,
      },
      {
        name: "web-ready",
        url: "https://www.example.test/ready",
        expectedStatus: 200,
        expectedOk: true,
      },
      {
        name: "admin-health",
        url: "https://admin.example.test/health",
        expectedStatus: 200,
        expectedOk: true,
      },
      {
        name: "admin-ready",
        url: "https://admin.example.test/ready",
        expectedStatus: 200,
        expectedOk: true,
      },
      {
        name: "worker-runtime-ready",
        url: "https://api.example.test/v1/admin/runtime/worker",
        expectedStatus: 200,
        expectedOk: true,
        requiredJson: {
          status: "ok",
        },
      },
    ], {
      maxAttempts: 3,
      delayMs: 250,
    });
  });

  it("prints failing readiness dependency details when a target returns ok=false", () => {
    const healthyPayload = "data:application/json,%7B%22ok%22%3Atrue%7D";
    const unhealthyPayload =
      "data:application/json,%7B%22ok%22%3Afalse%2C%22dependencies%22%3A%7B%22dbPublishingSchema%22%3A%22unavailable%22%7D%7D";
    const result = runReadinessSmokeScript({
      API_HEALTH_URL: healthyPayload,
      API_READY_URL: unhealthyPayload,
      WEB_HEALTH_URL: healthyPayload,
      WEB_READY_URL: healthyPayload,
      ADMIN_HEALTH_URL: healthyPayload,
      ADMIN_READY_URL: healthyPayload,
      WORKER_RUNTIME_URL: healthyPayload,
      READINESS_SMOKE_MAX_ATTEMPTS: "1",
      READINESS_SMOKE_DELAY_MS: "0",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Readiness smoke failed:");
    expect(result.stderr).toContain("api-ready failed after 1 attempts");
    expect(result.stderr).toContain("expected readiness payload ok=true, got ok=false");
    expect(result.stderr).toContain("dbPublishingSchema=unavailable");
  });

  it("waits for the worker runtime endpoint to report status ok, not just ok=true", () => {
    const healthyPayload = "data:application/json,%7B%22ok%22%3Atrue%7D";
    const workerStartingPayload =
      "data:application/json,%7B%22ok%22%3Atrue%2C%22status%22%3A%22starting%22%7D";
    const result = runReadinessSmokeScript({
      API_HEALTH_URL: healthyPayload,
      API_READY_URL: healthyPayload,
      WEB_HEALTH_URL: healthyPayload,
      WEB_READY_URL: healthyPayload,
      ADMIN_HEALTH_URL: healthyPayload,
      ADMIN_READY_URL: healthyPayload,
      WORKER_RUNTIME_URL: workerStartingPayload,
      READINESS_SMOKE_MAX_ATTEMPTS: "1",
      READINESS_SMOKE_DELAY_MS: "0",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("worker-runtime-ready failed after 1 attempts");
    expect(result.stderr).toContain('missing expected readiness JSON at $.status: expected "ok", got "starting"');
  });
});
