import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/smoke-routes.mjs");

afterEach(async () => {
  delete process.env.ROUTE_SMOKE_TIMEOUT_MS;
  delete process.env.ROUTE_SMOKE_POLL_INTERVAL_MS;
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
  it("accepts routes once the expected page markers are present", () => {
    const result = runRouteSmokeScript({
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
    expect(result.stderr).toContain("web-home-en failed after");
    expect(result.stderr).toContain("Trending merchants");
  });
});
