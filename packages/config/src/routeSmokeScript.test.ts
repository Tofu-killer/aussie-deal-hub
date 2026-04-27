import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/smoke-routes.mjs");

afterEach(async () => {
  delete process.env.ROUTE_SMOKE_TIMEOUT_MS;
  delete process.env.ROUTE_SMOKE_POLL_INTERVAL_MS;
  delete process.env.WEB_HOME_URL;
  delete process.env.WEB_SEARCH_URL;
  delete process.env.ADMIN_HOME_URL;
});

function runRouteSmokeScript(env: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ROUTE_SMOKE_TIMEOUT_MS: "20",
      ROUTE_SMOKE_POLL_INTERVAL_MS: "1",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("route smoke script", () => {
  it("does not execute the smoke run when the script is imported as a module", async () => {
    process.env.ROUTE_SMOKE_TIMEOUT_MS = "1";
    process.env.ROUTE_SMOKE_POLL_INTERVAL_MS = "1";
    process.env.WEB_HOME_URL = "data:text/html,%3Ch2%3ELatest%20deals%3C%2Fh2%3E";
    process.env.WEB_SEARCH_URL =
      "data:text/html,%3Ch1%3ESearch%20results%3C%2Fh1%3E%3Clabel%3ESearch%20deals%3C%2Flabel%3E%3Cp%3Eswitch%3C%2Fp%3E";
    process.env.ADMIN_HOME_URL =
      "data:text/html,%3Ch1%3EAdmin%20review%20dashboard%3C%2Fh1%3E%3Ch2%3ELive%20summary%3C%2Fh2%3E%3Ch2%3EWorkflow%20shortcuts%3C%2Fh2%3E";

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

  it("accepts routes once the expected page markers are present", () => {
    const result = runRouteSmokeScript({
      ROUTE_SMOKE_TIMEOUT_MS: "500",
      WEB_HOME_URL:
        "data:text/html,%3Ch2%3ELatest%20deals%3C%2Fh2%3E%3Ch2%3ETrending%20merchants%3C%2Fh2%3E%3Ca%3EOpen%20Favorites%3C%2Fa%3E",
      WEB_SEARCH_URL:
        "data:text/html,%3Ch1%3ESearch%20results%3C%2Fh1%3E%3Clabel%3ESearch%20deals%3C%2Flabel%3E%3Cp%3Eswitch%3C%2Fp%3E",
      ADMIN_HOME_URL:
        "data:text/html,%3Ch1%3EAdmin%20review%20dashboard%3C%2Fh1%3E%3Ch2%3ELive%20summary%3C%2Fh2%3E%3Ch2%3EWorkflow%20shortcuts%3C%2Fh2%3E",
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("falls back to the default runtime options when the route smoke env values are invalid", async () => {
    process.env.ROUTE_SMOKE_TIMEOUT_MS = "500";
    process.env.WEB_HOME_URL =
      "data:text/html,%3Ch2%3ELatest%20deals%3C%2Fh2%3E%3Ch2%3ETrending%20merchants%3C%2Fh2%3E%3Ca%3EOpen%20Favorites%3C%2Fa%3E";
    process.env.WEB_SEARCH_URL =
      "data:text/html,%3Ch1%3ESearch%20results%3C%2Fh1%3E%3Clabel%3ESearch%20deals%3C%2Flabel%3E%3Cp%3Eswitch%3C%2Fp%3E";
    process.env.ADMIN_HOME_URL =
      "data:text/html,%3Ch1%3EAdmin%20review%20dashboard%3C%2Fh1%3E%3Ch2%3ELive%20summary%3C%2Fh2%3E%3Ch2%3EWorkflow%20shortcuts%3C%2Fh2%3E";

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
      ],
      {
        totalTimeoutMs: 10_000,
        delayMs: 1_000,
      },
    );
  });

  it("fails when a route returns 200 but not the expected page content", () => {
    const result = runRouteSmokeScript({
      WEB_HOME_URL:
        "data:text/html,%3Ch2%3ELatest%20deals%3C%2Fh2%3E%3Ca%3EOpen%20Favorites%3C%2Fa%3E",
      WEB_SEARCH_URL:
        "data:text/html,%3Ch1%3ESearch%20results%3C%2Fh1%3E%3Clabel%3ESearch%20deals%3C%2Flabel%3E%3Cp%3Eswitch%3C%2Fp%3E",
      ADMIN_HOME_URL:
        "data:text/html,%3Ch1%3EAdmin%20review%20dashboard%3C%2Fh1%3E%3Ch2%3ELive%20summary%3C%2Fh2%3E%3Ch2%3EWorkflow%20shortcuts%3C%2Fh2%3E",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("web-home-en exceeded total timeout");
    expect(result.stderr).toContain("Trending merchants");
  });
});
