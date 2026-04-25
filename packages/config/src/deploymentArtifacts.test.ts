import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readComposeServiceBlock(compose: string, serviceName: string) {
  const lines = compose.split("\n");
  const serviceStart = lines.findIndex((line) => line === `  ${serviceName}:`);

  if (serviceStart === -1) {
    throw new Error(`Service ${serviceName} not found in docker-compose.yml`);
  }

  const serviceLines: string[] = [];

  for (let index = serviceStart; index < lines.length; index += 1) {
    const line = lines[index];

    if (index > serviceStart && line.startsWith("  ") && !line.startsWith("    ")) {
      break;
    }

    serviceLines.push(line);
  }

  return serviceLines.join("\n");
}

function readComposeServiceEnvironmentBlock(compose: string, serviceName: string) {
  const serviceBlock = readComposeServiceBlock(compose, serviceName);
  const lines = serviceBlock.split("\n");
  const environmentStart = lines.findIndex((line) => line === "    environment:");

  if (environmentStart === -1) {
    throw new Error(`Service ${serviceName} does not define an environment block`);
  }

  const environmentLines: string[] = [];

  for (let index = environmentStart + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.startsWith("      ")) {
      break;
    }

    environmentLines.push(line);
  }

  return environmentLines.join("\n");
}

describe("deployment artifacts", () => {
  it("defines a db-init service that applies schema and seed data before api startup", () => {
    const compose = readRepoFile("docker-compose.yml");

    expect(compose).toContain("db-init:");
    expect(compose).toContain("pnpm --filter @aussie-deal-hub/db db:push");
    expect(compose).toContain("pnpm --filter @aussie-deal-hub/db seed");
    expect(compose).toContain("service_completed_successfully");
    expect(compose).toContain("pg_isready -h 127.0.0.1 -U postgres -d aussie_deals_hub");
  });

  it("provides smtp delivery placeholders for production api and worker containers", () => {
    const compose = readRepoFile("docker-compose.yml");
    const apiEnvironment = readComposeServiceEnvironmentBlock(compose, "api");
    const workerEnvironment = readComposeServiceEnvironmentBlock(compose, "worker");

    expect(apiEnvironment).toContain("SMTP_HOST: smtp-placeholder");
    expect(apiEnvironment).toContain("SMTP_PORT: 1025");
    expect(workerEnvironment).toContain("SMTP_HOST: smtp-placeholder");
    expect(workerEnvironment).toContain("SMTP_PORT: 1025");
  });

  it("keeps dedicated runtime targets in the Dockerfile for api, web, admin, and worker", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("FROM workspace AS api");
    expect(dockerfile).toContain("FROM workspace AS web");
    expect(dockerfile).toContain("FROM workspace AS admin");
    expect(dockerfile).toContain("FROM workspace AS worker");
    expect(dockerfile).toContain("pnpm --filter @aussie-deal-hub/db prisma:generate");
    expect(dockerfile).toContain("apps/api/src/index.ts");
    expect(dockerfile).toContain("apps/worker/src/index.ts");
    expect(dockerfile).toContain("pnpm --filter @aussie-deal-hub/admin build");
    expect(dockerfile).toContain("pnpm --filter @aussie-deal-hub/web build");
    expect(dockerfile).toContain("require.resolve('prisma/build/index.js'");
    expect(dockerfile).toContain("validate --schema packages/db/prisma/schema.prisma");
  });

  it("verifies container artifacts in CI before merge", () => {
    const workflow = readRepoFile(".github/workflows/verify.yml");

    expect(workflow).toContain("docker build . --target api");
    expect(workflow).toContain("docker build . --target web");
    expect(workflow).toContain("docker build . --target admin");
    expect(workflow).toContain("docker build . --target worker");
    expect(workflow).toContain("docker compose config");
    expect(workflow).toContain("docker compose up -d --build");
    expect(workflow).toContain("pnpm smoke:readiness");
    expect(workflow).toContain("docker compose down -v");
  });

  it("exposes a readiness smoke script at the repo root", () => {
    const packageJson = readRepoFile("package.json");
    const smokeScript = readRepoFile("scripts/smoke-readiness.mjs");

    expect(packageJson).toContain("\"smoke:readiness\": \"node scripts/smoke-readiness.mjs\"");
    expect(smokeScript).toContain("/v1/ready");
    expect(smokeScript).toContain("/health");
    expect(smokeScript).toContain("/ready");
  });

  it("exposes a route smoke script at the repo root", () => {
    const packageJson = readRepoFile("package.json");
    const smokeScript = readRepoFile("scripts/smoke-routes.mjs");
    const workflow = readRepoFile(".github/workflows/verify.yml");

    expect(packageJson).toContain("\"smoke:routes\": \"node scripts/smoke-routes.mjs\"");
    expect(smokeScript).toContain("/en");
    expect(smokeScript).toContain("/en/search?q=switch");
    expect(smokeScript).toContain("http://127.0.0.1:3002/");
    expect(workflow).toContain("pnpm smoke:routes");
  });

  it("exposes db-backed test entrypoints for local and CI verification", () => {
    const packageJson = readRepoFile("package.json");
    const workflow = readRepoFile(".github/workflows/verify.yml");
    const readme = readRepoFile("README.md");
    const testDbScript = readRepoFile("scripts/test-db.mjs");

    expect(packageJson).toContain("\"test:db\": \"node scripts/test-db.mjs\"");
    expect(workflow).toContain("Prepare database for DB-backed tests");
    expect(workflow).toContain("pnpm test:db");
    expect(workflow).toContain("5433:5432");
    expect(workflow).toContain("127.0.0.1:5433");
    expect(workflow).toContain("services:");
    expect(workflow).toContain("postgres:");
    expect(readme).toContain("pnpm test:db");
    expect(readme).toContain("docker compose up -d postgres redis");
    expect(testDbScript).toContain("RUN_DB_TESTS: \"1\"");
    expect(testDbScript).toContain("\"vitest\"");
  });
});
