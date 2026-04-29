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

const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR ?? "backups");
const backupPrefix = process.env.BACKUP_PREFIX?.trim() || "aussie-deal-hub";
const backupTimestamp = process.env.BACKUP_TIMESTAMP?.trim() || formatTimestamp(new Date());
const backupPath = path.join(backupDir, `${backupPrefix}-${backupTimestamp}.dump`);
const postgresRuntime = createPostgresRuntimeEnvironment(databaseUrl);

mkdirSync(backupDir, { recursive: true });

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
