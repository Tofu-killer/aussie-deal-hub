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
  delete process.env.API_PUBLIC_DEALS_URL;
  delete process.env.API_PUBLIC_DEAL_URL;
});

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
      expect(env.API_PUBLIC_DEALS_URL).toBe("https://api.example.test/v1/public/deals/zh");
      expect(env.API_PUBLIC_DEAL_URL).toBe(
        "https://api.example.test/v1/public/deals/zh/route-smoke-missing-deal",
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
        API_PUBLIC_DEALS_URL: "https://override.example.test/v1/public/deals/en",
        API_PUBLIC_DEAL_URL: "https://override.example.test/v1/public/deals/en/custom-missing-deal",
        WEB_HOME_URL: "https://override.example.test/en",
        ADMIN_HOME_URL: "https://override.example.test/admin",
      }),
    ).toMatchObject({
      API_READY_URL: "https://override.example.test/v1/ready",
      WEB_HOME_URL: "https://override.example.test/en",
      ADMIN_HOME_URL: "https://override.example.test/admin",
      API_PUBLIC_DEALS_URL: "https://override.example.test/v1/public/deals/en",
      API_PUBLIC_DEAL_URL: "https://override.example.test/v1/public/deals/en/custom-missing-deal",
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

  it("fails fast when the public route smoke targets are incomplete", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?missing-public-route-target-test`)) as {
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
          API_HEALTH_URL: "https://api.example.test/v1/health",
          API_READY_URL: "https://api.example.test/v1/ready",
          WEB_HEALTH_URL: "https://www.example.test/health",
          WEB_READY_URL: "https://www.example.test/ready",
          ADMIN_HEALTH_URL: "https://admin.example.test/health",
          ADMIN_READY_URL: "https://admin.example.test/ready",
          WORKER_RUNTIME_URL: "https://api.example.test/v1/admin/runtime/worker",
          WEB_HOME_URL: "https://www.example.test/en",
          WEB_SEARCH_URL: "https://www.example.test/en/search?q=switch",
          ADMIN_HOME_URL: "https://admin.example.test",
          API_PUBLIC_DEAL_URL: "https://api.example.test/v1/public/deals/en/route-smoke-missing-deal",
        },
        {
          readinessRunner,
          routeRunner,
        },
      ),
    ).rejects.toThrow(
      "runtime:verify requires complete target URLs. Missing: API_PUBLIC_DEALS_URL",
    );

    expect(readinessRunner).not.toHaveBeenCalled();
    expect(routeRunner).not.toHaveBeenCalled();
  });
});
