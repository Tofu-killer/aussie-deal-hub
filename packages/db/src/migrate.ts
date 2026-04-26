import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const prismaCliPath = require.resolve("prisma/build/index.js");
const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

export const baselineMigrationName = "20260425000000_baseline";
export const checkedInSchemaDiffArgs = [
  "migrate",
  "diff",
  "--exit-code",
  "--from-schema-datasource",
  "prisma/schema.prisma",
  "--to-schema-datamodel",
  "prisma/schema.prisma",
];

export function shouldAttemptLegacyBaselineResolve({
  migrationsTableExists,
  publicTableNames,
}) {
  return !migrationsTableExists && publicTableNames.length > 0;
}

export async function readMigrationState(prismaClient) {
  const [{ regclass }] = await prismaClient.$queryRawUnsafe(
    "SELECT to_regclass('public._prisma_migrations')::text AS regclass",
  );
  const publicTables = await prismaClient.$queryRawUnsafe(`
    SELECT tablename AS "tableName"
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename ASC
  `);

  return {
    migrationsTableExists: regclass !== null,
    publicTableNames: publicTables.map((table) => table.tableName).sort(),
  };
}

export class PrismaCommandExitError extends Error {
  constructor(exitCode) {
    super(`Prisma command exited with code ${exitCode}`);
    this.exitCode = exitCode;
  }
}

export function runPrismaCommand(args, options = {}) {
  const result = spawnSync(process.execPath, [prismaCliPath, ...args], {
    cwd: packageRoot,
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new PrismaCommandExitError(result.status);
  }
}

export async function checkedInSchemaMatchesDatabase({
  runPrismaCommand: executePrismaCommand = runPrismaCommand,
} = {}) {
  try {
    await executePrismaCommand(checkedInSchemaDiffArgs, {
      stdio: "pipe",
    });
    return true;
  } catch (error) {
    if (error instanceof PrismaCommandExitError && error.exitCode === 2) {
      return false;
    }

    throw error;
  }
}

export async function deployMigrations({
  prismaClient,
  runPrismaCommand: executePrismaCommand = runPrismaCommand,
}) {
  const state = await readMigrationState(prismaClient);

  if (
    shouldAttemptLegacyBaselineResolve(state) &&
    (await checkedInSchemaMatchesDatabase({
      runPrismaCommand: executePrismaCommand,
    }))
  ) {
    await executePrismaCommand([
      "migrate",
      "resolve",
      "--applied",
      baselineMigrationName,
    ]);
  }

  await executePrismaCommand(["migrate", "deploy"]);
}

export async function main({
  PrismaClientClass = PrismaClient,
  runPrismaCommand: executePrismaCommand = runPrismaCommand,
} = {}) {
  const prismaClient = new PrismaClientClass();

  try {
    await deployMigrations({
      prismaClient,
      runPrismaCommand: executePrismaCommand,
    });
  } finally {
    await prismaClient.$disconnect();
  }
}

const entrypointPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (entrypointPath && fileURLToPath(import.meta.url) === entrypointPath) {
  main().catch((error) => {
    if (error instanceof PrismaCommandExitError) {
      process.exit(error.exitCode);
    }

    throw error;
  });
}
