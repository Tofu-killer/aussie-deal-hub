import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  readReleaseManifest,
  resolveConfiguredBundleRoot,
  resolveNewestBundleRoot,
} from "./lib/release-bundle-root.mjs";
import { runRuntimeVerifyScript } from "./runtime-verify.mjs";

const REQUIRED_DEPLOY_ENV = [
  "DEPLOY_HOST",
  "DEPLOY_USER",
  "DEPLOY_PATH",
  "DEPLOY_SSH_KEY_PATH",
  "DEPLOY_RUNTIME_API_BASE_URL",
  "DEPLOY_RUNTIME_WEB_BASE_URL",
  "DEPLOY_RUNTIME_ADMIN_BASE_URL",
];

function normalizeEnvValue(rawValue) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function normalizeRemotePath(rawValue) {
  const trimmedValue = normalizeEnvValue(rawValue);

  return trimmedValue ? trimmedValue.replace(/\/+$/u, "") : undefined;
}

function normalizeRelativeRemotePath(rawValue, fallbackValue) {
  const trimmedValue = normalizeEnvValue(rawValue) ?? fallbackValue;

  return trimmedValue.replace(/^\/+/u, "");
}

function quoteShellArgument(value) {
  return `'${String(value).replace(/'/gu, `'\\''`)}'`;
}

function resolveReleaseDeployRoot(cwd = process.cwd(), env = process.env) {
  const configuredRoot = normalizeEnvValue(env.RELEASE_DEPLOY_ROOT);

  if (configuredRoot) {
    return resolveConfiguredBundleRoot(cwd, configuredRoot);
  }

  return resolveNewestBundleRoot(cwd);
}

function validateReleaseDeployEnv(cwd, env) {
  const missingKeys = REQUIRED_DEPLOY_ENV.filter((key) => !normalizeEnvValue(env[key]));

  if (missingKeys.length > 0) {
    throw new Error(`release:deploy requires ${missingKeys.join(", ")}`);
  }

  const sshKeyPath = path.resolve(cwd, env.DEPLOY_SSH_KEY_PATH);

  if (!existsSync(sshKeyPath)) {
    throw new Error(`release:deploy could not find DEPLOY_SSH_KEY_PATH at ${sshKeyPath}`);
  }

  return {
    deployEnvFile: normalizeRelativeRemotePath(env.DEPLOY_ENV_FILE, ".env.production"),
    deployHost: normalizeEnvValue(env.DEPLOY_HOST),
    deployPath: normalizeRemotePath(env.DEPLOY_PATH),
    deployRuntimeAdminBaseUrl: normalizeEnvValue(env.DEPLOY_RUNTIME_ADMIN_BASE_URL),
    deployRuntimeApiBaseUrl: normalizeEnvValue(env.DEPLOY_RUNTIME_API_BASE_URL),
    deployRuntimeLocale: normalizeEnvValue(env.DEPLOY_RUNTIME_LOCALE),
    deployRuntimeWebBaseUrl: normalizeEnvValue(env.DEPLOY_RUNTIME_WEB_BASE_URL),
    deploySshPort: normalizeEnvValue(env.DEPLOY_SSH_PORT) ?? "22",
    deployUser: normalizeEnvValue(env.DEPLOY_USER),
    sshKeyPath,
  };
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    stdio: ["ignore", "inherit", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const renderedCommand = [command, ...args].join(" ");
    throw new Error(`Command failed (${result.status ?? 1}): ${renderedCommand}`);
  }
}

function buildSshArgs({ sshKeyPath, deploySshPort, remoteTarget, remoteCommand }) {
  return ["-i", sshKeyPath, "-p", deploySshPort, remoteTarget, remoteCommand];
}

function buildScpArgs({ sshKeyPath, deploySshPort, bundleRoot, remoteReleasesRoot, remoteTarget }) {
  return [
    "-i",
    sshKeyPath,
    "-P",
    deploySshPort,
    "-r",
    bundleRoot,
    `${remoteTarget}:${remoteReleasesRoot}/`,
  ];
}

export async function runReleaseDeployScript(
  cwd = process.cwd(),
  env = process.env,
  dependencies = {},
) {
  const runtimeVerifyRunner = dependencies.runtimeVerifyRunner ?? runRuntimeVerifyScript;
  const workingDirectory = realpathSync(cwd);
  const validatedDeployEnv = validateReleaseDeployEnv(workingDirectory, env);
  const bundleRoot = realpathSync(resolveReleaseDeployRoot(workingDirectory, env));
  const manifest = readReleaseManifest(bundleRoot);

  if (!manifest?.releaseName) {
    throw new Error(
      `Could not read release-manifest.json from ${path.relative(workingDirectory, bundleRoot) || "."}`,
    );
  }

  const {
    deployEnvFile,
    deployHost,
    deployPath,
    deployRuntimeAdminBaseUrl,
    deployRuntimeApiBaseUrl,
    deployRuntimeLocale,
    deployRuntimeWebBaseUrl,
    deploySshPort,
    deployUser,
    sshKeyPath,
  } = validatedDeployEnv;
  const remoteTarget = `${deployUser}@${deployHost}`;
  const remoteReleasesRoot = path.posix.join(deployPath, "releases");
  const remoteSharedRoot = path.posix.join(deployPath, "shared");
  const remoteSharedEnvFile = path.posix.join(remoteSharedRoot, deployEnvFile);
  const remoteCurrentRoot = path.posix.join(deployPath, "current");
  const remoteReleaseRoot = path.posix.join(remoteReleasesRoot, manifest.releaseName);
  const preflightCommand = [
    `mkdir -p ${quoteShellArgument(remoteReleasesRoot)} ${quoteShellArgument(remoteSharedRoot)}`,
    `test -f ${quoteShellArgument(remoteSharedEnvFile)}`,
  ].join(" && ");
  const deployCommand = [
    `ln -sfn ${quoteShellArgument(remoteReleaseRoot)} ${quoteShellArgument(remoteCurrentRoot)}`,
    `cd ${quoteShellArgument(remoteCurrentRoot)}`,
    `docker compose --env-file ${quoteShellArgument(remoteSharedEnvFile)} up -d --build`,
  ].join(" && ");
  const logsCommand = [
    `cd ${quoteShellArgument(remoteCurrentRoot)}`,
    `docker compose --env-file ${quoteShellArgument(remoteSharedEnvFile)} logs postgres redis db-init api web admin worker`,
  ].join(" && ");
  let stackAttempted = false;

  console.log(
    `Deploying release bundle ${manifest.releaseName} from ${path.relative(workingDirectory, bundleRoot) || "."}`,
  );

  try {
    runCommand(
      "ssh",
      buildSshArgs({
        deploySshPort,
        remoteCommand: preflightCommand,
        remoteTarget,
        sshKeyPath,
      }),
      { cwd: workingDirectory, env },
    );
    runCommand(
      "scp",
      buildScpArgs({
        bundleRoot,
        deploySshPort,
        remoteReleasesRoot,
        remoteTarget,
        sshKeyPath,
      }),
      { cwd: workingDirectory, env },
    );
    stackAttempted = true;
    runCommand(
      "ssh",
      buildSshArgs({
        deploySshPort,
        remoteCommand: deployCommand,
        remoteTarget,
        sshKeyPath,
      }),
      { cwd: workingDirectory, env },
    );
    await runtimeVerifyRunner({
      ...env,
      RUNTIME_ADMIN_BASE_URL: deployRuntimeAdminBaseUrl,
      RUNTIME_API_BASE_URL: deployRuntimeApiBaseUrl,
      RUNTIME_LOCALE: deployRuntimeLocale,
      RUNTIME_WEB_BASE_URL: deployRuntimeWebBaseUrl,
    });
  } catch (error) {
    if (stackAttempted) {
      try {
        runCommand(
          "ssh",
          buildSshArgs({
            deploySshPort,
            remoteCommand: logsCommand,
            remoteTarget,
            sshKeyPath,
          }),
          { cwd: workingDirectory, env },
        );
      } catch {
        // best-effort diagnostics
      }
    }

    throw error;
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runReleaseDeployScript().catch((error) => {
    console.error("Release deploy failed:", error);
    process.exitCode = 1;
  });
}
