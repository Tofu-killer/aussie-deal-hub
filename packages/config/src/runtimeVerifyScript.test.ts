import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/runtime-verify.mjs");

afterEach(() => {
  delete process.env.RUNTIME_API_BASE_URL;
  delete process.env.RUNTIME_WEB_BASE_URL;
  delete process.env.RUNTIME_ADMIN_BASE_URL;
  delete process.env.RUNTIME_LOCALE;
  delete process.env.API_HEALTH_URL;
  delete process.env.API_READY_URL;
  delete process.env.WEB_HEALTH_URL;
  delete process.env.WEB_READY_URL;
  delete process.env.ADMIN_HEALTH_URL;
  delete process.env.ADMIN_READY_URL;
  delete process.env.WORKER_RUNTIME_URL;
  delete process.env.WEB_HOME_URL;
  delete process.env.WEB_SEARCH_URL;
  delete process.env.ADMIN_HOME_URL;
  delete process.env.API_PUBLIC_DEAL_URL;
});

function runRuntimeVerifyScript(env: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ROUTE_SMOKE_TIMEOUT_MS: "500",
      ROUTE_SMOKE_POLL_INTERVAL_MS: "1",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("runtime verify script", () => {
  it("does not execute the runtime verify flow when imported as a module", async () => {
    const originalExitCode = process.exitCode;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.exitCode = undefined;

    try {
      const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?import-only`)) as {
        resolveRuntimeVerifyEnv?: (
          env: Record<string, string | undefined>,
        ) => Record<string, string | undefined>;
        runRuntimeVerifyScript?: (
          env: Record<string, string | undefined>,
          dependencies?: {
            readinessRunner?: (env: Record<string, string | undefined>) => Promise<void>;
            routeRunner?: (env: Record<string, string | undefined>) => Promise<void>;
          },
        ) => Promise<void>;
      };

      expect(typeof scriptModule.resolveRuntimeVerifyEnv).toBe("function");
      expect(typeof scriptModule.runRuntimeVerifyScript).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("derives readiness and route targets from runtime base URLs before running both smoke phases", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?runner-test`)) as {
      resolveRuntimeVerifyEnv?: (
        env: Record<string, string | undefined>,
      ) => Record<string, string | undefined>;
      runRuntimeVerifyScript?: (
        env: Record<string, string | undefined>,
        dependencies?: {
          readinessRunner?: (env: Record<string, string | undefined>) => Promise<void>;
          routeRunner?: (env: Record<string, string | undefined>) => Promise<void>;
        },
      ) => Promise<void>;
    };
    const calls: string[] = [];
    const readinessRunner = vi.fn(async (env: Record<string, string | undefined>) => {
      calls.push("readiness");
      expect(env.API_HEALTH_URL).toBe("https://api.example.test/v1/health");
      expect(env.API_READY_URL).toBe("https://api.example.test/v1/ready");
      expect(env.WORKER_RUNTIME_URL).toBe("https://api.example.test/v1/admin/runtime/worker");
      expect(env.WEB_HEALTH_URL).toBe("https://www.example.test/health");
      expect(env.WEB_READY_URL).toBe("https://www.example.test/ready");
      expect(env.ADMIN_HEALTH_URL).toBe("https://admin.example.test/console/health");
      expect(env.ADMIN_READY_URL).toBe("https://admin.example.test/console/ready");
    });
    const routeRunner = vi.fn(async (env: Record<string, string | undefined>) => {
      calls.push("routes");
      expect(env.WEB_HOME_URL).toBe("https://www.example.test/zh");
      expect(env.WEB_SEARCH_URL).toBe("https://www.example.test/zh/search?q=switch");
      expect(env.ADMIN_HOME_URL).toBe("https://admin.example.test/console");
      expect(env.API_PUBLIC_DEAL_URL).toBe(
        "https://api.example.test/v1/public/deals/zh/nintendo-switch-oled-amazon-au",
      );
    });

    expect(typeof scriptModule.resolveRuntimeVerifyEnv).toBe("function");
    expect(typeof scriptModule.runRuntimeVerifyScript).toBe("function");

    await scriptModule.runRuntimeVerifyScript?.(
      {
        RUNTIME_API_BASE_URL: "https://api.example.test/",
        RUNTIME_WEB_BASE_URL: "https://www.example.test/",
        RUNTIME_ADMIN_BASE_URL: "https://admin.example.test/console/",
        RUNTIME_LOCALE: "zh",
      },
      {
        readinessRunner,
        routeRunner,
      },
    );

    expect(calls).toEqual(["readiness", "routes"]);
  });

  it("keeps explicit target URLs instead of overwriting them with derived runtime defaults", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?override-test`)) as {
      resolveRuntimeVerifyEnv?: (
        env: Record<string, string | undefined>,
      ) => Record<string, string | undefined>;
    };

    expect(typeof scriptModule.resolveRuntimeVerifyEnv).toBe("function");

    expect(
      scriptModule.resolveRuntimeVerifyEnv?.({
        RUNTIME_API_BASE_URL: "https://api.example.test",
        RUNTIME_WEB_BASE_URL: "https://www.example.test",
        RUNTIME_ADMIN_BASE_URL: "https://admin.example.test",
        API_READY_URL: "https://override.example.test/v1/ready",
        API_PUBLIC_DEAL_URL: "https://override.example.test/v1/public/deals/en/custom-deal",
        WEB_HOME_URL: "https://override.example.test/en",
        ADMIN_HOME_URL: "https://override.example.test/admin",
      }),
    ).toMatchObject({
      API_READY_URL: "https://override.example.test/v1/ready",
      WEB_HOME_URL: "https://override.example.test/en",
      ADMIN_HOME_URL: "https://override.example.test/admin",
      API_PUBLIC_DEAL_URL: "https://override.example.test/v1/public/deals/en/custom-deal",
      API_HEALTH_URL: "https://api.example.test/v1/health",
      WEB_SEARCH_URL: "https://www.example.test/en/search?q=switch",
    });
  });

  it("fails fast when runtime verify targets are incomplete instead of silently falling back to localhost defaults", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?missing-targets-test`)) as {
      runRuntimeVerifyScript?: (
        env: Record<string, string | undefined>,
        dependencies?: {
          readinessRunner?: (env: Record<string, string | undefined>) => Promise<void>;
          routeRunner?: (env: Record<string, string | undefined>) => Promise<void>;
        },
      ) => Promise<void>;
    };
    const readinessRunner = vi.fn(async () => {});
    const routeRunner = vi.fn(async () => {});

    await expect(
      scriptModule.runRuntimeVerifyScript?.(
        {
          RUNTIME_API_BASE_URL: "https://api.example.test",
          RUNTIME_WEB_BASE_URL: "https://www.example.test",
        },
        {
          readinessRunner,
          routeRunner,
        },
      ),
    ).rejects.toThrow(
      "runtime:verify requires complete target URLs. Missing: ADMIN_HEALTH_URL, ADMIN_HOME_URL, ADMIN_READY_URL",
    );

    expect(readinessRunner).not.toHaveBeenCalled();
    expect(routeRunner).not.toHaveBeenCalled();
  });

  it("runs readiness and route smoke end-to-end with explicit target URLs", () => {
    const healthyPayload = "data:application/json,%7B%22ok%22%3Atrue%7D";
    const result = runRuntimeVerifyScript({
      API_HEALTH_URL: healthyPayload,
      API_READY_URL: healthyPayload,
      WEB_HEALTH_URL: healthyPayload,
      WEB_READY_URL: healthyPayload,
      ADMIN_HEALTH_URL: healthyPayload,
      ADMIN_READY_URL: healthyPayload,
      WORKER_RUNTIME_URL: healthyPayload,
      WEB_HOME_URL:
        "data:text/html,%3Ch2%3ELatest%20deals%3C%2Fh2%3E%3Ch2%3ETrending%20merchants%3C%2Fh2%3E%3Ca%3EOpen%20Favorites%3C%2Fa%3E",
      WEB_SEARCH_URL:
        "data:text/html,%3Ch1%3ESearch%20results%3C%2Fh1%3E%3Clabel%3ESearch%20deals%3C%2Flabel%3E%3Cp%3Eswitch%3C%2Fp%3E",
      ADMIN_HOME_URL:
        "data:text/html,%3Ch1%3EAdmin%20review%20dashboard%3C%2Fh1%3E%3Ch2%3ELive%20summary%3C%2Fh2%3E%3Ch2%3EWorkflow%20shortcuts%3C%2Fh2%3E",
      API_PUBLIC_DEAL_URL:
        "data:application/json,%7B%22locale%22%3A%22en%22%2C%22slug%22%3A%22nintendo-switch-oled-amazon-au%22%2C%22title%22%3A%22Nintendo%20Switch%20OLED%20for%20A%24399%20at%20Amazon%20AU%22%7D",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });
});
