import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { createPostgresRuntimeEnvironment, fail } from "./lib/postgres-runtime.mjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail("DATABASE_URL is required to restore a runtime backup.");
}

const backupFile = process.env.BACKUP_FILE?.trim();

if (!backupFile) {
  fail("BACKUP_FILE is required to restore a runtime backup.");
}

const backupPath = path.resolve(process.cwd(), backupFile);

if (!existsSync(backupPath)) {
  fail(`BACKUP_FILE does not exist: ${path.relative(process.cwd(), backupPath)}`);
}

if (path.extname(backupPath).toLowerCase() !== ".dump") {
  fail("BACKUP_FILE must point to a custom-format .dump artifact created by pnpm runtime:backup.");
}

if (process.env.RESTORE_CONFIRM?.trim() !== "restore") {
  fail("RESTORE_CONFIRM=restore is required before pnpm runtime:restore will modify the target database.");
}

const resolvedBackupPath = realpathSync(backupPath);
const postgresRuntime = createPostgresRuntimeEnvironment(databaseUrl);

let result;

try {
  result = spawnSync(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--exit-on-error", resolvedBackupPath],
    {
      encoding: "utf8",
      env: postgresRuntime.environment,
      stdio: ["ignore", "inherit", "pipe"],
    },
  );
} finally {
  postgresRuntime.cleanup();
}

if (result.error) {
  if (result.error.code === "ENOENT") {
    fail("pg_restore was not found in PATH. Install PostgreSQL client tools before running pnpm runtime:restore.");
  }

  throw result.error;
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Restored runtime backup from ${path.relative(process.cwd(), resolvedBackupPath)}`);
