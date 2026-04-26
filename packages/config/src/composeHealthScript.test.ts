import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/check-compose-health.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  delete process.env.DOCKER_BIN;
  delete process.env.COMPOSE_HEALTH_SERVICES;
  delete process.env.COMPOSE_HEALTH_TIMEOUT_MS;
  delete process.env.COMPOSE_HEALTH_POLL_INTERVAL_MS;

  await Promise.all(
    tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

async function createFakeDocker(outputs: string[]) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "adh-compose-health-"));
  const dockerPath = path.join(tempDir, "docker");
  const outputPath = path.join(tempDir, "outputs.json");

  tempDirs.push(tempDir);
  await writeFile(outputPath, JSON.stringify(outputs));
  await writeFile(
    dockerPath,
    `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const outputPath = process.env.FAKE_DOCKER_OUTPUT_PATH;
const outputs = JSON.parse(readFileSync(outputPath, "utf8"));
const nextOutput = outputs.length > 0 ? outputs[0] : "[]";

if (outputs.length > 1) {
  writeFileSync(outputPath, JSON.stringify(outputs.slice(1)));
}

process.stdout.write(nextOutput);
`,
  );
  await chmod(dockerPath, 0o755);

  return {
    dockerPath,
    outputPath,
  };
}

function runComposeHealthScript(env: Record<string, string>) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      COMPOSE_HEALTH_SERVICES: "api,web,admin,worker",
      COMPOSE_HEALTH_TIMEOUT_MS: "20",
      COMPOSE_HEALTH_POLL_INTERVAL_MS: "1",
      ...env,
    },
    encoding: "utf8",
  });
}

describe("compose healthcheck script", () => {
  it("accepts a compose stack once all required services are healthy", async () => {
    expect(existsSync(scriptPath)).toBe(true);

    if (!existsSync(scriptPath)) {
      return;
    }

    const fakeDocker = await createFakeDocker([
      JSON.stringify([
        { Service: "api", State: "running", Health: "healthy" },
        { Service: "web", State: "running", Health: "healthy" },
        { Service: "admin", State: "running", Health: "healthy" },
        { Service: "worker", State: "running", Health: "healthy" },
      ]),
    ]);

    const result = runComposeHealthScript({
      DOCKER_BIN: fakeDocker.dockerPath,
      FAKE_DOCKER_OUTPUT_PATH: fakeDocker.outputPath,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("fails with the pending service states once the timeout elapses", async () => {
    expect(existsSync(scriptPath)).toBe(true);

    if (!existsSync(scriptPath)) {
      return;
    }

    const fakeDocker = await createFakeDocker([
      JSON.stringify([
        { Service: "api", State: "running", Health: "healthy" },
        { Service: "web", State: "running", Health: "starting" },
        { Service: "admin", State: "running", Health: "healthy" },
        { Service: "worker", State: "running", Health: "starting" },
      ]),
      JSON.stringify([
        { Service: "api", State: "running", Health: "healthy" },
        { Service: "web", State: "running", Health: "starting" },
        { Service: "admin", State: "running", Health: "healthy" },
        { Service: "worker", State: "running", Health: "starting" },
      ]),
    ]);

    const result = runComposeHealthScript({
      DOCKER_BIN: fakeDocker.dockerPath,
      FAKE_DOCKER_OUTPUT_PATH: fakeDocker.outputPath,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("web=running/starting");
    expect(result.stderr).toContain("worker=running/starting");
  });

  it("fails when a required service reports no health status", async () => {
    expect(existsSync(scriptPath)).toBe(true);

    if (!existsSync(scriptPath)) {
      return;
    }

    const fakeDocker = await createFakeDocker([
      JSON.stringify([
        { Service: "api", State: "running", Health: "healthy" },
        { Service: "web", State: "running", Health: "" },
        { Service: "admin", State: "running", Health: "healthy" },
        { Service: "worker", State: "running", Health: "healthy" },
      ]),
      JSON.stringify([
        { Service: "api", State: "running", Health: "healthy" },
        { Service: "web", State: "running", Health: "" },
        { Service: "admin", State: "running", Health: "healthy" },
        { Service: "worker", State: "running", Health: "healthy" },
      ]),
    ]);

    const result = runComposeHealthScript({
      DOCKER_BIN: fakeDocker.dockerPath,
      FAKE_DOCKER_OUTPUT_PATH: fakeDocker.outputPath,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("web=running");
  });
});
