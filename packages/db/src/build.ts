import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const prismaBuildPlaceholderDatabaseUrl =
  "postgresql://placeholder:placeholder@127.0.0.1:5432/aussie_deals_hub";

const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve("prisma/build/index.js");
const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function normalizeEnvValue(rawValue: string | undefined) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function runPrismaCommand(args: string[]) {
  const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
    cwd: packageRoot,
    env: {
      ...process.env,
      DATABASE_URL: normalizeEnvValue(process.env.DATABASE_URL) ?? prismaBuildPlaceholderDatabaseUrl,
    },
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function buildDatabasePackage() {
  runPrismaCommand(["generate"]);
  runPrismaCommand(["validate"]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildDatabasePackage();
}
