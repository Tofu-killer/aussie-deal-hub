import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
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

const REMOTE_SITE_URL_ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "SITE_URL"];

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

function buildRemoteEnvPresenceCheck(envFilePath, envKeys) {
  return envKeys
    .map((envKey) => `grep -Eq '^${envKey}=.+$' ${quoteShellArgument(envFilePath)}`)
    .join(" || ");
}

function resolveReleaseDeployRoot(cwd = process.cwd(), env = process.env) {
  const configuredRoot = normalizeEnvValue(env.RELEASE_DEPLOY_ROOT);

  if (configuredRoot) {
    return resolveConfiguredBundleRoot(cwd, configuredRoot);
  }

  return resolveNewestBundleRoot(cwd);
}

function resolveReleaseDeployDiagnosticsRoot(cwd, releaseName, env) {
  const configuredRoot = normalizeEnvValue(env.RELEASE_DEPLOY_DIAGNOSTICS_ROOT);
  const baseRoot = configuredRoot
    ? path.resolve(cwd, configuredRoot)
    : path.join(cwd, "artifacts", "release-deploy");

  return path.join(baseRoot, releaseName);
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

function runCommandCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
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

  return result.stdout ?? "";
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

function resolveCurrentReleaseRoot(context) {
  const currentReleaseCommand = `if [ -L ${quoteShellArgument(context.remoteCurrentRoot)} ]; then readlink ${quoteShellArgument(context.remoteCurrentRoot)}; fi`;
  const currentReleaseRoot = runCommandCapture(
    "ssh",
    buildSshArgs({
      deploySshPort: context.deploySshPort,
      remoteCommand: currentReleaseCommand,
      remoteTarget: context.remoteTarget,
      sshKeyPath: context.sshKeyPath,
    }),
    { cwd: context.cwd, env: context.env },
  ).trim();

  return normalizeRemotePath(currentReleaseRoot);
}

function serializeError(error) {
  if (error instanceof Error) {
    return error.stack ? `${error.stack}\n` : `${error.message}\n`;
  }

  return `${String(error)}\n`;
}

function writeDiagnosticsFile(diagnosticsRoot, fileName, contents) {
  writeFileSync(path.join(diagnosticsRoot, fileName), contents, "utf8");
}

function persistReleaseDeployDiagnostics(context) {
  const diagnosticsRoot = resolveReleaseDeployDiagnosticsRoot(
    context.cwd,
    context.releaseName,
    context.env,
  );
  const metadata = {
    bundleRoot: path.relative(context.cwd, context.bundleRoot) || ".",
    currentReleaseRoot: context.currentReleaseRoot ?? null,
    previousReleaseRoot: context.previousReleaseRoot ?? null,
    releaseActivated: context.releaseActivated,
    remoteCurrentRoot: context.remoteCurrentRoot,
    remoteReleaseRoot: context.remoteReleaseRoot,
    remoteSharedEnvFile: context.remoteSharedEnvFile,
    releaseName: context.releaseName,
  };

  mkdirSync(diagnosticsRoot, { recursive: true });
  writeDiagnosticsFile(diagnosticsRoot, "metadata.json", `${JSON.stringify(metadata, null, 2)}\n`);
  writeDiagnosticsFile(diagnosticsRoot, "deploy-error.txt", serializeError(context.error));

  if (context.composeLogs) {
    writeDiagnosticsFile(diagnosticsRoot, "compose-logs.txt", context.composeLogs);
  }

  if (context.composeLogsError) {
    writeDiagnosticsFile(
      diagnosticsRoot,
      "compose-logs-error.txt",
      serializeError(context.composeLogsError),
    );
  }

  return diagnosticsRoot;
}

function writeRollbackDiagnostics(diagnosticsRoot, fileName, contents) {
  if (!diagnosticsRoot) {
    return;
  }

  writeDiagnosticsFile(diagnosticsRoot, fileName, contents);
}

export async function runReleaseDeployScript(
  cwd = process.cwd(),
  env = process.env,
  dependencies = {},
) {
  const resolveCurrentReleaseRootRunner =
    dependencies.resolveCurrentReleaseRootRunner ?? resolveCurrentReleaseRoot;
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
  const runtimeVerifyEnv = {
    ...env,
    RUNTIME_ADMIN_BASE_URL: deployRuntimeAdminBaseUrl,
    RUNTIME_API_BASE_URL: deployRuntimeApiBaseUrl,
    RUNTIME_LOCALE: deployRuntimeLocale,
    RUNTIME_WEB_BASE_URL: deployRuntimeWebBaseUrl,
  };
  const preflightCommand = [
    `mkdir -p ${quoteShellArgument(remoteReleasesRoot)} ${quoteShellArgument(remoteSharedRoot)}`,
    `test -f ${quoteShellArgument(remoteSharedEnvFile)}`,
    `(${buildRemoteEnvPresenceCheck(remoteSharedEnvFile, REMOTE_SITE_URL_ENV_KEYS)})`,
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
  let previousReleaseRoot;
  let stackAttempted = false;

  console.log(
    `Deploying release bundle ${manifest.releaseName} from ${path.relative(workingDirectory, bundleRoot) || "."}`,
  );

  try {
    previousReleaseRoot = normalizeRemotePath(
      await resolveCurrentReleaseRootRunner({
        cwd: workingDirectory,
        deploySshPort,
        env,
        remoteCurrentRoot,
        remoteTarget,
        sshKeyPath,
      }),
    );
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
    await runtimeVerifyRunner(runtimeVerifyEnv);
  } catch (error) {
    let currentReleaseRoot;
    let diagnosticsRoot;
    let releaseActivated = false;
    let rollbackPerformed = false;

    if (stackAttempted) {
      try {
        currentReleaseRoot = normalizeRemotePath(
          await resolveCurrentReleaseRootRunner({
            cwd: workingDirectory,
            deploySshPort,
            env,
            remoteCurrentRoot,
            remoteTarget,
            sshKeyPath,
          }),
        );
        releaseActivated = currentReleaseRoot === remoteReleaseRoot;
      } catch {
        // best-effort activation detection
      }

      if (releaseActivated) {
        let composeLogs;
        let composeLogsError;

        try {
          composeLogs = runCommandCapture(
            "ssh",
            buildSshArgs({
              deploySshPort,
              remoteCommand: logsCommand,
              remoteTarget,
              sshKeyPath,
            }),
            { cwd: workingDirectory, env },
          );
        } catch (diagnosticsError) {
          composeLogsError = diagnosticsError;
        }

        try {
          diagnosticsRoot = persistReleaseDeployDiagnostics({
            bundleRoot,
            composeLogs,
            composeLogsError,
            currentReleaseRoot,
            cwd: workingDirectory,
            env,
            error,
            previousReleaseRoot,
            releaseActivated,
            releaseName: manifest.releaseName,
            remoteCurrentRoot,
            remoteReleaseRoot,
            remoteSharedEnvFile,
          });
          console.error(
            `Saved deploy diagnostics to ${path.relative(workingDirectory, diagnosticsRoot) || "."}`,
          );
        } catch (persistError) {
          console.error(
            `Could not persist deploy diagnostics: ${persistError instanceof Error ? persistError.message : String(persistError)}`,
          );
        }

        if (previousReleaseRoot) {
          const rollbackCommand = [
            `ln -sfn ${quoteShellArgument(previousReleaseRoot)} ${quoteShellArgument(remoteCurrentRoot)}`,
            `cd ${quoteShellArgument(remoteCurrentRoot)}`,
            `docker compose --env-file ${quoteShellArgument(remoteSharedEnvFile)} up -d --build`,
          ].join(" && ");

          try {
            runCommand(
              "ssh",
              buildSshArgs({
                deploySshPort,
                remoteCommand: rollbackCommand,
                remoteTarget,
                sshKeyPath,
              }),
              { cwd: workingDirectory, env },
            );
            await runtimeVerifyRunner(runtimeVerifyEnv);
            rollbackPerformed = true;
            writeRollbackDiagnostics(
              diagnosticsRoot,
              "rollback-result.txt",
              `Rolled back to ${previousReleaseRoot} and runtime verification passed.\n`,
            );
          } catch (rollbackError) {
            try {
              writeRollbackDiagnostics(
                diagnosticsRoot,
                "rollback-error.txt",
                serializeError(rollbackError),
              );
            } catch {
              // best-effort diagnostics
            }

            const rollbackFailure = new Error(
              `Release deploy failed and rollback to ${previousReleaseRoot} failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
              { cause: error },
            );

            throw rollbackFailure;
          }
        }
      }
    }

    if (rollbackPerformed) {
      throw new Error(
        `Release deploy failed, rolled back to ${previousReleaseRoot}, original error: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
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
