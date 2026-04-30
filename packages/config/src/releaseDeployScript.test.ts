import { spawnSync } from "node:child_process";
import {
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
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/release-deploy.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

async function createTempWorkspace() {
  const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-release-deploy-"));
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

describe("release deploy script", () => {
  it("does not execute the deploy flow when imported as a module", async () => {
    const originalExitCode = process.exitCode;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    process.exitCode = undefined;

    try {
      const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?import-only`)) as {
        runReleaseDeployScript?: (
          cwd?: string,
          env?: Record<string, string | undefined>,
          dependencies?: {
            runtimeVerifyRunner?: (env: Record<string, string | undefined>) => Promise<void>;
          },
        ) => Promise<void>;
      };

      expect(typeof scriptModule.runReleaseDeployScript).toBe("function");
      expect(consoleError).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    } finally {
      consoleError.mockRestore();
      process.exitCode = originalExitCode;
    }
  });

  it("deploys the newest staged bundle over ssh and verifies the deployed runtime", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    await writeFile(sshKeyPath, "private-key\n");
    const olderBundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T100000Z-older",
      "2026-04-30T10:00:00.000Z",
    );
    const newerBundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T110000Z-newer",
      "2026-04-30T11:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);
    const runtimeVerifyRunner = vi.fn(async (env: Record<string, string | undefined>) => {
      expect(env.RUNTIME_API_BASE_URL).toBe("https://api.example.com");
      expect(env.RUNTIME_WEB_BASE_URL).toBe("https://www.example.com");
      expect(env.RUNTIME_ADMIN_BASE_URL).toBe("https://admin.example.com");
      expect(env.RUNTIME_LOCALE).toBe("zh");
    });
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?success-test`)) as {
      runReleaseDeployScript?: (
        cwd?: string,
        env?: Record<string, string | undefined>,
        dependencies?: {
          runtimeVerifyRunner?: (env: Record<string, string | undefined>) => Promise<void>;
        },
      ) => Promise<void>;
    };

    expect(typeof scriptModule.runReleaseDeployScript).toBe("function");

    await scriptModule.runReleaseDeployScript?.(workspaceRoot, {
      CAPTURE_FILE: captureFilePath,
      DEPLOY_ENV_FILE: ".env.production",
      DEPLOY_HOST: "deploy.example.com",
      DEPLOY_PATH: "/srv/aussie-deal-hub",
      DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
      DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
      DEPLOY_RUNTIME_LOCALE: "zh",
      DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
      DEPLOY_SSH_KEY_PATH: sshKeyPath,
      DEPLOY_SSH_PORT: "2222",
      DEPLOY_USER: "deploy",
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    }, {
      runtimeVerifyRunner,
    });

    expect(runtimeVerifyRunner).toHaveBeenCalledTimes(1);

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
    const resolvedWorkspaceRoot = await realpath(workspaceRoot);
    const resolvedNewerBundleRoot = await realpath(newerBundleRoot);
    const resolvedOlderBundleRoot = await realpath(olderBundleRoot);

    expect(captureLines).toEqual([
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "2222",
          "deploy@deploy.example.com",
          "mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production'",
        ],
      },
      {
        command: "scp",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-P",
          "2222",
          "-r",
          resolvedNewerBundleRoot,
          "deploy@deploy.example.com:/srv/aussie-deal-hub/releases/",
        ],
      },
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "2222",
          "deploy@deploy.example.com",
          "ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T110000Z-newer' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build",
        ],
      },
    ]);
    expect(captureLines.flatMap((entry) => entry.argv)).not.toContain(resolvedOlderBundleRoot);
  });

  it("captures remote compose logs when runtime verification fails after deployment", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    await writeFile(sshKeyPath, "private-key\n");
    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T120000Z-failing",
      "2026-04-30T12:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?verify-failure-test`)) as {
      runReleaseDeployScript?: (
        cwd?: string,
        env?: Record<string, string | undefined>,
        dependencies?: {
          runtimeVerifyRunner?: (env: Record<string, string | undefined>) => Promise<void>;
        },
      ) => Promise<void>;
    };

    await expect(
      scriptModule.runReleaseDeployScript?.(workspaceRoot, {
        CAPTURE_FILE: captureFilePath,
        DEPLOY_HOST: "deploy.example.com",
        DEPLOY_PATH: "/srv/aussie-deal-hub",
        DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
        DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
        DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
        DEPLOY_SSH_KEY_PATH: sshKeyPath,
        DEPLOY_USER: "deploy",
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        RELEASE_DEPLOY_ROOT: bundleRoot,
      }, {
        runtimeVerifyRunner: async () => {
          throw new Error("runtime verify failed");
        },
      }),
    ).rejects.toThrow("runtime verify failed");

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
    const resolvedWorkspaceRoot = await realpath(workspaceRoot);
    const resolvedBundleRoot = await realpath(bundleRoot);

    expect(captureLines).toEqual([
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "22",
          "deploy@deploy.example.com",
          "mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production'",
        ],
      },
      {
        command: "scp",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-P",
          "22",
          "-r",
          resolvedBundleRoot,
          "deploy@deploy.example.com:/srv/aussie-deal-hub/releases/",
        ],
      },
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "22",
          "deploy@deploy.example.com",
          "ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T120000Z-failing' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build",
        ],
      },
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "22",
          "deploy@deploy.example.com",
          "cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' logs postgres redis db-init api web admin worker",
        ],
      },
    ]);
  });

  it("fails fast when required deploy environment variables are missing", async () => {
    const scriptModule = (await import(`${pathToFileURL(scriptPath).href}?missing-env-test`)) as {
      runReleaseDeployScript?: (
        cwd?: string,
        env?: Record<string, string | undefined>,
        dependencies?: {
          runtimeVerifyRunner?: (env: Record<string, string | undefined>) => Promise<void>;
        },
      ) => Promise<void>;
    };

    await expect(
      scriptModule.runReleaseDeployScript?.(repoRoot, {
        DEPLOY_HOST: "deploy.example.com",
      }),
    ).rejects.toThrow(
      "release:deploy requires DEPLOY_USER, DEPLOY_PATH, DEPLOY_SSH_KEY_PATH, DEPLOY_RUNTIME_API_BASE_URL, DEPLOY_RUNTIME_WEB_BASE_URL, DEPLOY_RUNTIME_ADMIN_BASE_URL",
    );
  });

  it("exits non-zero from the cli entrypoint when the deploy command fails", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    await writeFile(sshKeyPath, "private-key\n");
    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T130000Z-cli",
      "2026-04-30T13:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        CAPTURE_FILE: captureFilePath,
        DEPLOY_HOST: "deploy.example.com",
        DEPLOY_PATH: "/srv/aussie-deal-hub",
        DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
        DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
        DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
        DEPLOY_SSH_KEY_PATH: sshKeyPath,
        DEPLOY_USER: "deploy",
        FAIL_COMMAND: `ssh -i ${sshKeyPath} -p 22 deploy@deploy.example.com ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T130000Z-cli' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build`,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        RELEASE_DEPLOY_ROOT: bundleRoot,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Release deploy failed:");
  });
});
