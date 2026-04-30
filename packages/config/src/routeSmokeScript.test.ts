import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/smoke-routes.mjs");

function buildRouteSmokeEnv(baseUrl = "https://example.test"): Record<string, string> {
  return {
    ROUTE_SMOKE_TIMEOUT_MS: "500",
    WEB_HOME_URL: `${baseUrl}/en`,
    WEB_SEARCH_URL: `${baseUrl}/en/search?q=switch`,
    ADMIN_HOME_URL: `${baseUrl}/admin`,
    API_PUBLIC_DEALS_URL: `${baseUrl}/v1/public/deals/en`,
    API_PUBLIC_DEAL_URL: `${baseUrl}/v1/public/deals/en/route-smoke-missing-deal`,
  };
}

afterEach(async () => {
  delete process.env.ROUTE_SMOKE_TIMEOUT_MS;
  delete process.env.ROUTE_SMOKE_POLL_INTERVAL_MS;
  delete process.env.WEB_HOME_URL;
  delete process.env.WEB_SEARCH_URL;
  delete process.env.ADMIN_HOME_URL;
  delete process.env.API_PUBLIC_DEALS_URL;
  delete process.env.API_PUBLIC_DEAL_URL;
});

describe("route smoke script", () => {
  it("does not execute the smoke run when the script is imported as a module", async () => {
    process.env.ROUTE_SMOKE_TIMEOUT_MS = "1";
    process.env.ROUTE_SMOKE_POLL_INTERVAL_MS = "1";

    const originalExitCode = process.exitCode;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.exitCode = undefined;

    try {
      const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?import-only`)) as {
        runRouteSmokeScript?: (
          env: Record<string, string | undefined>,
          runner?: (...args: unknown[]) => Promise<void>,
        ) => Promise<void>;
      };

      expect(typeof scriptModule.runRouteSmokeScript).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("builds the stable web, admin, and public API route contracts before invoking the runner", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?targets-test`)) as {
      runRouteSmokeScript?: (
        env: Record<string, string | undefined>,
        runner?: (...args: unknown[]) => Promise<void>,
      ) => Promise<void>;
    };
    const runner = vi.fn(async () => undefined);

    await scriptModule.runRouteSmokeScript?.(
      buildRouteSmokeEnv("https://smoke.example.test"),
      runner,
    );

    expect(runner).toHaveBeenCalledWith(
      [
        {
          name: "web-home-en",
          url: "https://smoke.example.test/en",
          expectedStatus: 200,
          requiredText: ["Latest deals", "Trending merchants", "Open Favorites"],
        },
        {
          name: "web-search-en",
          url: "https://smoke.example.test/en/search?q=switch",
          expectedStatus: 200,
          requiredText: ["Search results", "Search deals", "switch"],
        },
        {
          name: "admin-home",
          url: "https://smoke.example.test/admin",
          expectedStatus: 200,
          requiredText: ["Admin review dashboard", "Live summary", "Workflow shortcuts"],
        },
        {
          name: "api-public-deals-en",
          url: "https://smoke.example.test/v1/public/deals/en",
          expectedStatus: 200,
          requiredJson: {
            items: [],
          },
        },
        {
          name: "api-public-deal-missing-en",
          url: "https://smoke.example.test/v1/public/deals/en/route-smoke-missing-deal",
          expectedStatus: 404,
          requiredJson: {
            message: "Deal not found.",
          },
        },
      ],
      {
        totalTimeoutMs: 500,
        delayMs: 1000,
      },
    );
  });

  it("falls back to the default runtime options when the route smoke env values are invalid", async () => {
    process.env.ROUTE_SMOKE_TIMEOUT_MS = "500";

    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?runner-test`)) as {
      runRouteSmokeScript?: (
        env: Record<string, string | undefined>,
        runner?: (...args: unknown[]) => Promise<void>,
      ) => Promise<void>;
    };
    const runner = vi.fn(async () => undefined);

    expect(typeof scriptModule.runRouteSmokeScript).toBe("function");

    await scriptModule.runRouteSmokeScript?.(
      {
        ROUTE_SMOKE_TIMEOUT_MS: "invalid",
        ROUTE_SMOKE_POLL_INTERVAL_MS: "0",
        WEB_HOME_URL: "https://example.test/en",
        WEB_SEARCH_URL: "https://example.test/en/search?q=switch",
        ADMIN_HOME_URL: "https://example.test/admin",
        API_PUBLIC_DEALS_URL: "https://api.example.test/v1/public/deals/en",
        API_PUBLIC_DEAL_URL: "https://api.example.test/v1/public/deals/en/route-smoke-missing-deal",
      },
      runner,
    );

    expect(runner).toHaveBeenCalledWith(
      [
        {
          name: "web-home-en",
          url: "https://example.test/en",
          expectedStatus: 200,
          requiredText: ["Latest deals", "Trending merchants", "Open Favorites"],
        },
        {
          name: "web-search-en",
          url: "https://example.test/en/search?q=switch",
          expectedStatus: 200,
          requiredText: ["Search results", "Search deals", "switch"],
        },
        {
          name: "admin-home",
          url: "https://example.test/admin",
          expectedStatus: 200,
          requiredText: ["Admin review dashboard", "Live summary", "Workflow shortcuts"],
        },
        {
          name: "api-public-deals-en",
          url: "https://api.example.test/v1/public/deals/en",
          expectedStatus: 200,
          requiredJson: {
            items: [],
          },
        },
        {
          name: "api-public-deal-missing-en",
          url: "https://api.example.test/v1/public/deals/en/route-smoke-missing-deal",
          expectedStatus: 404,
          requiredJson: {
            message: "Deal not found.",
          },
        },
      ],
      {
        totalTimeoutMs: 10_000,
        delayMs: 1_000,
      },
    );
  });

  it("propagates route smoke runner failures instead of swallowing them", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?error-test`)) as {
      runRouteSmokeScript?: (
        env: Record<string, string | undefined>,
        runner?: (...args: unknown[]) => Promise<void>,
      ) => Promise<void>;
    };
    const runner = vi.fn(async () => {
      throw new Error("route runner exploded");
    });

    await expect(
      scriptModule.runRouteSmokeScript?.(
        buildRouteSmokeEnv("https://failure.example.test"),
        runner,
      ),
    ).rejects.toThrow("route runner exploded");

    expect(runner).toHaveBeenCalledTimes(1);
  });

  it("fails fast when either public API route target is omitted", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?missing-route-test`)) as {
      buildRouteSmokeTargets?: (
        env: Record<string, string | undefined>,
      ) => Array<Record<string, unknown>>;
    };

    expect(
      scriptModule.buildRouteSmokeTargets?.({
        WEB_HOME_URL: "https://example.test/en",
        WEB_SEARCH_URL: "https://example.test/en/search?q=switch",
        ADMIN_HOME_URL: "https://example.test/admin",
        API_PUBLIC_DEALS_URL: "https://api.example.test/v1/public/deals/en",
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "api-public-deals-en",
        }),
        expect.objectContaining({
          name: "api-public-deal-missing-en",
        }),
      ]),
    );
  });
});
