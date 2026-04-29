import { spawnSync } from "node:child_process";
import {
  appendFile,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/release-rehearse.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

async function createTempWorkspace() {
  const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-release-rehearse-"));
  tempDirs.push(tempRepoRoot);

  return tempRepoRoot;
}

async function writeReleaseBundle(
  workspaceRoot: string,
  bundleName: string,
  createdAt: string,
) {
  const bundleRoot = path.join(workspaceRoot, "release", bundleName);

  await mkdir(bundleRoot, { recursive: true });
  await writeFile(
    path.join(bundleRoot, "release-manifest.json"),
    `${JSON.stringify(
      {
        createdAt,
        gitSha: "abcdef1234567890",
        includedPaths: ["package.json", "scripts"],
        releaseName: bundleName,
      },
      null,
      2,
    )}\n`,
  );

  return bundleRoot;
}

async function installFakeCommand(
  workspaceRoot: string,
  commandName: string,
  captureFilePath: string,
) {
  const binDir = path.join(workspaceRoot, "bin");
  const runnerPath = path.join(binDir, `${commandName}.js`);
  const launcherPath = path.join(
    binDir,
    process.platform === "win32" ? `${commandName}.cmd` : commandName,
  );
  const runnerContents = [
    "#!/usr/bin/env node",
    "const { appendFileSync } = require('node:fs');",
    "const entry = JSON.stringify({",
    `  command: ${JSON.stringify(commandName)},`,
    "  cwd: process.cwd(),",
    "  argv: process.argv.slice(2),",
    "});",
    "appendFileSync(process.env.CAPTURE_FILE, `${entry}\\n`);",
    "const failToken = process.env.FAIL_COMMAND;",
    `if (failToken === ${JSON.stringify(commandName)} || failToken === [${JSON.stringify(commandName)}, ...process.argv.slice(2)].join(' ')) {`,
    "  process.exit(1);",
    "}",
  ].join("\n");
  const launcherContents =
    process.platform === "win32"
      ? ['@echo off', `node "%~dp0\\${commandName}.js" %*`].join("\r\n")
      : runnerContents;

  await mkdir(binDir, { recursive: true });
  await writeFile(runnerPath, runnerContents);
  await writeFile(launcherPath, launcherContents);

  if (process.platform !== "win32") {
    await chmod(launcherPath, 0o755);
  }

  return binDir;
}

function runReleaseRehearseScript(
  workspaceRoot: string,
  env: Record<string, string | undefined> = {},
) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ...env,
    },
    encoding: "utf8",
  });
}

describe("release rehearse script", () => {
  it("uses the newest release bundle under release/ by default and runs the full rehearsal flow", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const olderBundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T000000Z-older",
      "2026-04-30T00:00:00.000Z",
    );
    const newerBundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T010000Z-newer",
      "2026-04-30T01:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "pnpm", captureFilePath);
    await installFakeCommand(workspaceRoot, "docker", captureFilePath);

    const result = runReleaseRehearseScript(workspaceRoot, {
      CAPTURE_FILE: captureFilePath,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.relative(workspaceRoot, newerBundleRoot));
    expect(result.stdout).not.toContain(path.relative(workspaceRoot, olderBundleRoot));

    const captureLines = (await readFile(captureFilePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) =>
        JSON.parse(line) as {
          argv: string[];
          command: string;
          cwd: string;
        },
      );
    const resolvedNewerBundleRoot = await realpath(newerBundleRoot);

    expect(captureLines).toEqual([
      {
        command: "pnpm",
        cwd: resolvedNewerBundleRoot,
        argv: ["install", "--frozen-lockfile"],
      },
      {
        command: "docker",
        cwd: resolvedNewerBundleRoot,
        argv: ["compose", "up", "-d", "--build"],
      },
      {
        command: "pnpm",
        cwd: resolvedNewerBundleRoot,
        argv: ["smoke:container-health"],
      },
      {
        command: "pnpm",
        cwd: resolvedNewerBundleRoot,
        argv: ["smoke:readiness"],
      },
      {
        command: "pnpm",
        cwd: resolvedNewerBundleRoot,
        argv: ["smoke:routes"],
      },
      {
        command: "docker",
        cwd: resolvedNewerBundleRoot,
        argv: ["compose", "down", "-v"],
      },
    ]);
  });

  it("dumps compose logs and still tears the stack down when a smoke step fails", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T020000Z-failing",
      "2026-04-30T02:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "pnpm", captureFilePath);
    await installFakeCommand(workspaceRoot, "docker", captureFilePath);

    const result = runReleaseRehearseScript(workspaceRoot, {
      CAPTURE_FILE: captureFilePath,
      FAIL_COMMAND: "pnpm smoke:readiness",
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      RELEASE_REHEARSE_ROOT: bundleRoot,
    });

    expect(result.status).toBe(1);

    const captureLines = (await readFile(captureFilePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) =>
        JSON.parse(line) as {
          argv: string[];
          command: string;
          cwd: string;
        },
      );
    const resolvedBundleRoot = await realpath(bundleRoot);

    expect(captureLines).toEqual([
      {
        command: "pnpm",
        cwd: resolvedBundleRoot,
        argv: ["install", "--frozen-lockfile"],
      },
      {
        command: "docker",
        cwd: resolvedBundleRoot,
        argv: ["compose", "up", "-d", "--build"],
      },
      {
        command: "pnpm",
        cwd: resolvedBundleRoot,
        argv: ["smoke:container-health"],
      },
      {
        command: "pnpm",
        cwd: resolvedBundleRoot,
        argv: ["smoke:readiness"],
      },
      {
        command: "docker",
        cwd: resolvedBundleRoot,
        argv: ["compose", "logs", "postgres", "redis", "db-init", "api", "web", "admin", "worker"],
      },
      {
        command: "docker",
        cwd: resolvedBundleRoot,
        argv: ["compose", "down", "-v"],
      },
    ]);
  });

  it("dumps compose logs and still tears the stack down when docker compose up fails", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T030000Z-up-failing",
      "2026-04-30T03:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "pnpm", captureFilePath);
    await installFakeCommand(workspaceRoot, "docker", captureFilePath);

    const result = runReleaseRehearseScript(workspaceRoot, {
      CAPTURE_FILE: captureFilePath,
      FAIL_COMMAND: "docker compose up -d --build",
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      RELEASE_REHEARSE_ROOT: bundleRoot,
    });

    expect(result.status).toBe(1);

    const captureLines = (await readFile(captureFilePath, "utf8"))
      .trim()
      .split("\n")
      .map((line) =>
        JSON.parse(line) as {
          argv: string[];
          command: string;
          cwd: string;
        },
      );
    const resolvedBundleRoot = await realpath(bundleRoot);

    expect(captureLines).toEqual([
      {
        command: "pnpm",
        cwd: resolvedBundleRoot,
        argv: ["install", "--frozen-lockfile"],
      },
      {
        command: "docker",
        cwd: resolvedBundleRoot,
        argv: ["compose", "up", "-d", "--build"],
      },
      {
        command: "docker",
        cwd: resolvedBundleRoot,
        argv: ["compose", "logs", "postgres", "redis", "db-init", "api", "web", "admin", "worker"],
      },
      {
        command: "docker",
        cwd: resolvedBundleRoot,
        argv: ["compose", "down", "-v"],
      },
    ]);
  });

  it("fails with a clear error when no release bundle manifest can be found", async () => {
    const workspaceRoot = await createTempWorkspace();

    const result = runReleaseRehearseScript(workspaceRoot);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find a release bundle manifest under");
    expect(result.stderr).toContain(path.join("release"));
  });
});
