import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdirSync } from "node:fs";
import {
  createPostgresRuntimeEnvironment,
  fail,
  formatTimestamp,
} from "./lib/postgres-runtime.mjs";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail("DATABASE_URL is required to create a runtime backup.");
}

const configuredBackupFile = process.env.BACKUP_FILE?.trim();
const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR ?? "backups");
const backupPrefix = process.env.BACKUP_PREFIX?.trim() || "aussie-deal-hub";
const backupTimestamp = process.env.BACKUP_TIMESTAMP?.trim() || formatTimestamp(new Date());
const backupPath = configuredBackupFile
  ? path.resolve(process.cwd(), configuredBackupFile)
  : path.join(backupDir, `${backupPrefix}-${backupTimestamp}.dump`);

if (path.extname(backupPath).toLowerCase() !== ".dump") {
  fail("BACKUP_FILE must point to a custom-format .dump artifact path for pnpm runtime:backup.");
}

const postgresRuntime = createPostgresRuntimeEnvironment(databaseUrl);

mkdirSync(path.dirname(backupPath), { recursive: true });

let result;

try {
  result = spawnSync(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", backupPath],
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
    fail("pg_dump was not found in PATH. Install PostgreSQL client tools before running pnpm runtime:backup.");
  }

  throw result.error;
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Created runtime backup at ${path.relative(process.cwd(), backupPath)}`);
