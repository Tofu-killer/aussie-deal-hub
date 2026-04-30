import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

function normalizeEnvValue(rawValue) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function parseBooleanEnv(rawValue) {
  const normalizedValue = normalizeEnvValue(rawValue)?.toLowerCase();

  if (normalizedValue === undefined) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return undefined;
}

export function shouldRunDbBackedVerification(env = process.env) {
  const explicitVerifyDb = parseBooleanEnv(env.VERIFY_DB);

  if (explicitVerifyDb !== undefined) {
    return explicitVerifyDb;
  }

  return normalizeEnvValue(env.DATABASE_URL) !== undefined;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status ?? 1}): ${[command, ...args].join(" ")}`);
  }
}

function withoutDatabaseUrl(env) {
  const commandEnv = { ...env };

  delete commandEnv.DATABASE_URL;

  return commandEnv;
}

export async function runVerifyWorkspaceScript(
  env = process.env,
  dependencies = {},
) {
  const commandRunner = dependencies.runCommand ?? runCommand;
  const standardVerificationEnv = withoutDatabaseUrl(env);

  commandRunner("pnpm", ["build"], { env: standardVerificationEnv });
  commandRunner("pnpm", ["test"], { env: standardVerificationEnv });

  if (shouldRunDbBackedVerification(env)) {
    commandRunner("pnpm", ["--filter", "@aussie-deal-hub/db", "db:migrate"], { env });
    commandRunner("pnpm", ["test:db"], { env });
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runVerifyWorkspaceScript().catch((error) => {
    console.error("Workspace verify failed:", error);
    process.exitCode = 1;
  });
}
