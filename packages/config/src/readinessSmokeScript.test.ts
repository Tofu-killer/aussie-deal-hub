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
        runReadinessSmokeScript?: (
          env: Record<string, string | undefined>,
          runner?: (...args: unknown[]) => Promise<void>,
        ) => Promise<void>;
      };

      expect(typeof scriptModule.buildReadinessSmokeTargets).toBe("function");
      expect(typeof scriptModule.runReadinessSmokeScript).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("accepts healthy readiness targets once every endpoint returns 200", () => {
    const result = runReadinessSmokeScript({
      API_HEALTH_URL: "data:text/plain,ok",
      API_READY_URL: "data:text/plain,ok",
      WEB_HEALTH_URL: "data:text/plain,ok",
      WEB_READY_URL: "data:text/plain,ok",
      ADMIN_HEALTH_URL: "data:text/plain,ok",
      ADMIN_READY_URL: "data:text/plain,ok",
      WORKER_RUNTIME_URL: "data:text/plain,ok",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("passes the configured readiness targets to the injected runner", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?runner-test`)) as {
      buildReadinessSmokeTargets?: (env: Record<string, string | undefined>) => unknown[];
      runReadinessSmokeScript?: (
        env: Record<string, string | undefined>,
        runner?: (...args: unknown[]) => Promise<void>,
      ) => Promise<void>;
    };
    const runner = vi.fn(async () => undefined);

    expect(typeof scriptModule.buildReadinessSmokeTargets).toBe("function");
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
      },
      runner,
    );

    expect(runner).toHaveBeenCalledWith([
      {
        name: "api-health",
        url: "https://api.example.test/v1/health",
        expectedStatus: 200,
      },
      {
        name: "api-ready",
        url: "https://api.example.test/v1/ready",
        expectedStatus: 200,
      },
      {
        name: "web-health",
        url: "https://www.example.test/health",
        expectedStatus: 200,
      },
      {
        name: "web-ready",
        url: "https://www.example.test/ready",
        expectedStatus: 200,
      },
      {
        name: "admin-health",
        url: "https://admin.example.test/health",
        expectedStatus: 200,
      },
      {
        name: "admin-ready",
        url: "https://admin.example.test/ready",
        expectedStatus: 200,
      },
      {
        name: "worker-runtime-ready",
        url: "https://api.example.test/v1/admin/runtime/worker",
        expectedStatus: 200,
      },
    ]);
  });
});
