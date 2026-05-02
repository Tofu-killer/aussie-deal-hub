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
type RuntimeVerifyRunner = (env: Record<string, string | undefined>) => Promise<void>;
type ResolveCurrentReleaseRootRunner = (context: {
  cwd: string;
  deploySshPort: string;
  env: Record<string, string | undefined>;
  remoteCurrentRoot: string;
  remoteTarget: string;
  sshKeyPath: string;
}) => Promise<string | undefined> | string | undefined;
type ReleaseDeployScriptModule = {
  runReleaseDeployScript?: (
    cwd?: string,
    env?: Record<string, string | undefined>,
    dependencies?: {
      resolveCurrentReleaseRootRunner?: ResolveCurrentReleaseRootRunner;
      runtimeVerifyRunner?: RuntimeVerifyRunner;
    },
  ) => Promise<void>;
};

const deployEnvPresenceCheck =
  "(grep -Eq '^NEXT_PUBLIC_SITE_URL=.+$' '/srv/aussie-deal-hub/shared/.env.production' || " +
  "grep -Eq '^SITE_URL=.+$' '/srv/aussie-deal-hub/shared/.env.production')";

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
    "const stdoutEntries = JSON.parse(process.env.FAKE_COMMAND_STDOUT_JSON ?? '{}');",
    `const renderedCommand = [${JSON.stringify(commandName)}, ...process.argv.slice(2)].join(' ');`,
    "const stdout = stdoutEntries[renderedCommand] ?? stdoutEntries[process.argv.slice(2).join(' ')] ?? stdoutEntries[process.argv.at(-1) ?? ''] ?? '';",
    "if (stdout) {",
    "  process.stdout.write(stdout);",
    "}",
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
      const scriptModule = (await import(
        `${pathToFileURL(scriptPath).href}?import-only`
      )) as ReleaseDeployScriptModule;

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
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?success-test`
    )) as ReleaseDeployScriptModule;

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
          "if [ -L '/srv/aussie-deal-hub/current' ]; then readlink '/srv/aussie-deal-hub/current'; fi",
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
          `mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production' && ${deployEnvPresenceCheck}`,
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

  it("captures remote compose logs when runtime verification fails after current switches to the new release", async () => {
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
    const remoteReleaseRoot =
      "/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T120000Z-failing";
    const psRemoteCommand =
      "cd '/srv/aussie-deal-hub/current' && " +
      "docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' ps --all";
    const logsRemoteCommand =
      "cd '/srv/aussie-deal-hub/current' && " +
      "docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' " +
      "logs postgres redis db-init api web admin worker";
    const resolveCurrentReleaseRootRunner = vi
      .fn<ResolveCurrentReleaseRootRunner>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(remoteReleaseRoot);
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?verify-failure-test`
    )) as ReleaseDeployScriptModule;

    await expect(
      scriptModule.runReleaseDeployScript?.(
        workspaceRoot,
        {
          CAPTURE_FILE: captureFilePath,
          DEPLOY_HOST: "deploy.example.com",
          DEPLOY_PATH: "/srv/aussie-deal-hub",
          DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
          DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
          DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
          DEPLOY_SSH_KEY_PATH: sshKeyPath,
          DEPLOY_USER: "deploy",
          FAKE_COMMAND_STDOUT_JSON: JSON.stringify({
            [psRemoteCommand]: "NAME   IMAGE   COMMAND   SERVICE   CREATED   STATUS   PORTS\napi-1  api     node      api       now       unhealthy   0.0.0.0:3001->3001/tcp\n",
            [logsRemoteCommand]: "api-1  | unhealthy\nworker-1  | ready\n",
          }),
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
          RELEASE_DEPLOY_ROOT: bundleRoot,
        },
        {
          resolveCurrentReleaseRootRunner,
          runtimeVerifyRunner: async () => {
            throw new Error("runtime verify failed");
          },
        },
      ),
    ).rejects.toThrow("runtime verify failed");

    expect(resolveCurrentReleaseRootRunner).toHaveBeenCalledTimes(2);

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
          `mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production' && ${deployEnvPresenceCheck}`,
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
          "cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' ps --all",
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

    const diagnosticsRoot = path.join(
      workspaceRoot,
      "artifacts",
      "release-deploy",
      "aussie-deal-hub-release-20260430T120000Z-failing",
    );
    const metadata = JSON.parse(
      await readFile(path.join(diagnosticsRoot, "metadata.json"), "utf8"),
    ) as {
      currentReleaseRoot: string;
      failureStage: string | null;
      previousReleaseRoot: string | null;
      releaseActivated: boolean;
      remoteReleaseRoot: string;
      runtimeVerifyTargets: {
        adminBaseUrl: string;
        apiBaseUrl: string;
        locale: string | null;
        webBaseUrl: string;
      };
    };

    expect(metadata).toEqual(
      expect.objectContaining({
        currentReleaseRoot: remoteReleaseRoot,
        failureStage: "post-deploy-runtime-verify",
        previousReleaseRoot: null,
        releaseActivated: true,
        remoteReleaseRoot,
        runtimeVerifyTargets: {
          adminBaseUrl: "https://admin.example.com",
          apiBaseUrl: "https://api.example.com",
          locale: null,
          webBaseUrl: "https://www.example.com",
        },
      }),
    );
    await expect(readFile(path.join(diagnosticsRoot, "compose-ps.txt"), "utf8")).resolves.toBe(
      "NAME   IMAGE   COMMAND   SERVICE   CREATED   STATUS   PORTS\napi-1  api     node      api       now       unhealthy   0.0.0.0:3001->3001/tcp\n",
    );
    await expect(readFile(path.join(diagnosticsRoot, "compose-logs.txt"), "utf8")).resolves.toBe(
      "api-1  | unhealthy\nworker-1  | ready\n",
    );
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).resolves.toContain(
      "phase: post-deploy",
    );
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).resolves.toContain(
      "apiBaseUrl: https://api.example.com",
    );
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).resolves.toContain(
      "webBaseUrl: https://www.example.com",
    );
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).resolves.toContain(
      "adminBaseUrl: https://admin.example.com",
    );
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).resolves.toContain(
      "Running runtime verify (post-deploy).",
    );
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).resolves.toContain(
      "outcome:\nfailed",
    );
    await expect(readFile(path.join(diagnosticsRoot, "deploy-error.txt"), "utf8")).resolves.toContain(
      "runtime verify failed",
    );
  });

  it("does not capture logs or rollback when activation fails before current changes", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    const previousReleaseRoot =
      "/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T090000Z-stable";
    const releaseName = "aussie-deal-hub-release-20260430T125000Z-pre-switch-failure";

    await writeFile(sshKeyPath, "private-key\n");

    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      releaseName,
      "2026-04-30T12:50:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);

    const resolveCurrentReleaseRootRunner = vi
      .fn<ResolveCurrentReleaseRootRunner>()
      .mockResolvedValueOnce(previousReleaseRoot)
      .mockResolvedValueOnce(previousReleaseRoot);
    const runtimeVerifyRunner = vi.fn<RuntimeVerifyRunner>();
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?pre-switch-failure-test`
    )) as ReleaseDeployScriptModule;
    const deployRemoteCommand =
      `ln -sfn '/srv/aussie-deal-hub/releases/${releaseName}' '/srv/aussie-deal-hub/current' && ` +
      "cd '/srv/aussie-deal-hub/current' && " +
      "docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build";
    const deployCommand = `ssh -i ${sshKeyPath} -p 22 deploy@deploy.example.com ${deployRemoteCommand}`;

    await expect(
      scriptModule.runReleaseDeployScript?.(
        workspaceRoot,
        {
          CAPTURE_FILE: captureFilePath,
          DEPLOY_HOST: "deploy.example.com",
          DEPLOY_PATH: "/srv/aussie-deal-hub",
          DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
          DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
          DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
          DEPLOY_SSH_KEY_PATH: sshKeyPath,
          DEPLOY_USER: "deploy",
          FAIL_COMMAND: deployCommand,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
          RELEASE_DEPLOY_ROOT: bundleRoot,
        },
        {
          resolveCurrentReleaseRootRunner,
          runtimeVerifyRunner,
        },
      ),
    ).rejects.toThrow(`Command failed (1): ${deployCommand}`);

    expect(resolveCurrentReleaseRootRunner).toHaveBeenCalledTimes(2);
    expect(runtimeVerifyRunner).not.toHaveBeenCalled();

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
          `mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production' && ${deployEnvPresenceCheck}`,
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
          "ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T125000Z-pre-switch-failure' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build",
        ],
      },
    ]);

  });

  it("rolls back to the previous current release when runtime verification fails after activation", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    const previousReleaseRoot =
      "/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T090000Z-stable";

    await writeFile(sshKeyPath, "private-key\n");

    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      "aussie-deal-hub-release-20260430T140000Z-candidate",
      "2026-04-30T14:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);

    const runtimeVerifyRunner = vi
      .fn<RuntimeVerifyRunner>()
      .mockRejectedValueOnce(new Error("runtime verify failed"))
      .mockResolvedValueOnce();
    const resolveCurrentReleaseRootRunner = vi
      .fn<ResolveCurrentReleaseRootRunner>()
      .mockResolvedValueOnce(previousReleaseRoot)
      .mockResolvedValueOnce("/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T140000Z-candidate");
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?rollback-test`
    )) as ReleaseDeployScriptModule;

    await expect(
      scriptModule.runReleaseDeployScript?.(
        workspaceRoot,
        {
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
        },
        {
          resolveCurrentReleaseRootRunner,
          runtimeVerifyRunner,
        },
      ),
    ).rejects.toThrow("runtime verify failed");

    expect(resolveCurrentReleaseRootRunner).toHaveBeenCalledTimes(2);
    expect(runtimeVerifyRunner).toHaveBeenCalledTimes(2);

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
          `mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production' && ${deployEnvPresenceCheck}`,
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
          "ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T140000Z-candidate' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build",
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
          "cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' ps --all",
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
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "22",
          "deploy@deploy.example.com",
          "ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T090000Z-stable' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build",
        ],
      },
    ]);

    const diagnosticsRoot = path.join(
      workspaceRoot,
      "artifacts",
      "release-deploy",
      "aussie-deal-hub-release-20260430T140000Z-candidate",
    );
    await expect(readFile(path.join(diagnosticsRoot, "rollback-result.txt"), "utf8")).resolves.toBe(
      `Rolled back to ${previousReleaseRoot} and runtime verification passed.\n`,
    );
    await expect(readFile(path.join(diagnosticsRoot, "rollback-runtime-verify.txt"), "utf8")).resolves.toContain(
      "phase: rollback",
    );
    await expect(readFile(path.join(diagnosticsRoot, "rollback-runtime-verify.txt"), "utf8")).resolves.toContain(
      "Runtime verify (rollback) passed.",
    );
    await expect(readFile(path.join(diagnosticsRoot, "rollback-runtime-verify.txt"), "utf8")).resolves.toContain(
      "outcome:\npassed",
    );
  });

  it("rolls back when activation fails after current changes", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    const previousReleaseRoot =
      "/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T090000Z-stable";
    const releaseName = "aussie-deal-hub-release-20260430T150000Z-activation-failure";
    const remoteReleaseRoot = `/srv/aussie-deal-hub/releases/${releaseName}`;

    await writeFile(sshKeyPath, "private-key\n");

    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      releaseName,
      "2026-04-30T15:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);

    const resolveCurrentReleaseRootRunner = vi
      .fn<ResolveCurrentReleaseRootRunner>()
      .mockResolvedValueOnce(previousReleaseRoot)
      .mockResolvedValueOnce(remoteReleaseRoot);
    const runtimeVerifyRunner = vi.fn<RuntimeVerifyRunner>().mockResolvedValueOnce();
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?activation-rollback-test`
    )) as ReleaseDeployScriptModule;
    const deployRemoteCommand =
      `ln -sfn '${remoteReleaseRoot}' '/srv/aussie-deal-hub/current' && ` +
      "cd '/srv/aussie-deal-hub/current' && " +
      "docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build";
    const deployCommand = `ssh -i ${sshKeyPath} -p 22 deploy@deploy.example.com ${deployRemoteCommand}`;

    await expect(
      scriptModule.runReleaseDeployScript?.(
        workspaceRoot,
        {
          CAPTURE_FILE: captureFilePath,
          DEPLOY_HOST: "deploy.example.com",
          DEPLOY_PATH: "/srv/aussie-deal-hub",
          DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
          DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
          DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
          DEPLOY_SSH_KEY_PATH: sshKeyPath,
          DEPLOY_USER: "deploy",
          FAIL_COMMAND: deployCommand,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
          RELEASE_DEPLOY_ROOT: bundleRoot,
        },
        {
          resolveCurrentReleaseRootRunner,
          runtimeVerifyRunner,
        },
      ),
    ).rejects.toThrow(
      `Release deploy failed, rolled back to ${previousReleaseRoot}, original error: Command failed (1): ${deployCommand}`,
    );

    expect(resolveCurrentReleaseRootRunner).toHaveBeenCalledTimes(2);
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
          `mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production' && ${deployEnvPresenceCheck}`,
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
        argv: ["-i", sshKeyPath, "-p", "22", "deploy@deploy.example.com", deployRemoteCommand],
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
          "cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' ps --all",
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
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: [
          "-i",
          sshKeyPath,
          "-p",
          "22",
          "deploy@deploy.example.com",
          "ln -sfn '/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T090000Z-stable' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build",
        ],
      },
    ]);

    const diagnosticsRoot = path.join(workspaceRoot, "artifacts", "release-deploy", releaseName);
    const metadata = JSON.parse(
      await readFile(path.join(diagnosticsRoot, "metadata.json"), "utf8"),
    ) as {
      failureStage: string | null;
    };

    expect(metadata.failureStage).toBe("deploy-activation");
    await expect(readFile(path.join(diagnosticsRoot, "runtime-verify.txt"), "utf8")).rejects.toThrow(
      /ENOENT/u,
    );
  });

  it("surfaces rollback failures after activation", async () => {
    const workspaceRoot = await createTempWorkspace();
    const captureFilePath = path.join(workspaceRoot, "command-capture.jsonl");
    const sshKeyPath = path.join(workspaceRoot, "deploy-key");
    const previousReleaseRoot =
      "/srv/aussie-deal-hub/releases/aussie-deal-hub-release-20260430T090000Z-stable";
    const releaseName = "aussie-deal-hub-release-20260430T160000Z-rollback-failure";
    const remoteReleaseRoot = `/srv/aussie-deal-hub/releases/${releaseName}`;

    await writeFile(sshKeyPath, "private-key\n");

    const bundleRoot = await writeReleaseBundle(
      workspaceRoot,
      releaseName,
      "2026-04-30T16:00:00.000Z",
    );
    const binDir = await installFakeCommand(workspaceRoot, "ssh", captureFilePath);
    await installFakeCommand(workspaceRoot, "scp", captureFilePath);

    const runtimeVerifyFailure = new Error("runtime verify failed");
    const runtimeVerifyRunner = vi
      .fn<RuntimeVerifyRunner>()
      .mockRejectedValueOnce(runtimeVerifyFailure);
    const resolveCurrentReleaseRootRunner = vi
      .fn<ResolveCurrentReleaseRootRunner>()
      .mockResolvedValueOnce(previousReleaseRoot)
      .mockResolvedValueOnce(remoteReleaseRoot);
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?rollback-failure-test`
    )) as ReleaseDeployScriptModule;
    const rollbackRemoteCommand =
      `ln -sfn '${previousReleaseRoot}' '/srv/aussie-deal-hub/current' && ` +
      "cd '/srv/aussie-deal-hub/current' && " +
      "docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build";
    const rollbackCommand = `ssh -i ${sshKeyPath} -p 22 deploy@deploy.example.com ${rollbackRemoteCommand}`;

    const thrownError = await scriptModule
      .runReleaseDeployScript?.(
        workspaceRoot,
        {
          CAPTURE_FILE: captureFilePath,
          DEPLOY_HOST: "deploy.example.com",
          DEPLOY_PATH: "/srv/aussie-deal-hub",
          DEPLOY_RUNTIME_ADMIN_BASE_URL: "https://admin.example.com",
          DEPLOY_RUNTIME_API_BASE_URL: "https://api.example.com",
          DEPLOY_RUNTIME_WEB_BASE_URL: "https://www.example.com",
          DEPLOY_SSH_KEY_PATH: sshKeyPath,
          DEPLOY_USER: "deploy",
          FAIL_COMMAND: rollbackCommand,
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
          RELEASE_DEPLOY_ROOT: bundleRoot,
        },
        {
          resolveCurrentReleaseRootRunner,
          runtimeVerifyRunner,
        },
      )
      .then(() => null)
      .catch((error) => error as Error);

    expect(thrownError).toBeInstanceOf(Error);
    expect(thrownError?.message).toBe(
      `Release deploy failed and rollback to ${previousReleaseRoot} failed: Command failed (1): ${rollbackCommand}`,
    );
    expect(thrownError?.cause).toBe(runtimeVerifyFailure);
    expect(resolveCurrentReleaseRootRunner).toHaveBeenCalledTimes(2);
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
          `mkdir -p '/srv/aussie-deal-hub/releases' '/srv/aussie-deal-hub/shared' && test -f '/srv/aussie-deal-hub/shared/.env.production' && ${deployEnvPresenceCheck}`,
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
          `ln -sfn '${remoteReleaseRoot}' '/srv/aussie-deal-hub/current' && cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' up -d --build`,
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
          "cd '/srv/aussie-deal-hub/current' && docker compose --env-file '/srv/aussie-deal-hub/shared/.env.production' ps --all",
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
      {
        command: "ssh",
        cwd: resolvedWorkspaceRoot,
        argv: ["-i", sshKeyPath, "-p", "22", "deploy@deploy.example.com", rollbackRemoteCommand],
      },
    ]);
  });

  it("fails fast when required deploy environment variables are missing", async () => {
    const scriptModule = (await import(
      `${pathToFileURL(scriptPath).href}?missing-env-test`
    )) as ReleaseDeployScriptModule;

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
