import { spawnSync } from "node:child_process";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub";
const testFiles = [
  "apps/api/tests/adminCatalog.persistence.test.ts",
  "apps/api/tests/adminLeads.test.ts",
  "apps/api/tests/adminPublishing.test.ts",
  "apps/api/tests/adminSnapshots.test.ts",
  "apps/api/tests/adminSources.persistence.test.ts",
  "apps/api/tests/adminTopics.persistence.test.ts",
  "apps/api/tests/digestSubscriptions.persistence.test.ts",
  "apps/api/tests/favorites.persistence.test.ts",
  "apps/api/tests/publicDealPriceContext.test.ts",
];

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
    ...testFiles,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      RUN_DB_TESTS: "1",
    },
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
