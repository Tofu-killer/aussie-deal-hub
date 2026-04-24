import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../../..");

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("deployment artifacts", () => {
  it("defines a db-init service that applies schema and seed data before api startup", () => {
    const compose = readRepoFile("docker-compose.yml");

    expect(compose).toContain("db-init:");
    expect(compose).toContain("pnpm --filter @aussie-deal-hub/db db:push");
    expect(compose).toContain("pnpm --filter @aussie-deal-hub/db seed");
    expect(compose).toContain("service_completed_successfully");
  });

  it("keeps dedicated runtime targets in the Dockerfile for api, web, and admin", () => {
    const dockerfile = readRepoFile("Dockerfile");

    expect(dockerfile).toContain("FROM workspace AS api");
    expect(dockerfile).toContain("FROM workspace AS web");
    expect(dockerfile).toContain("FROM workspace AS admin");
  });
});
