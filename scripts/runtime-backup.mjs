import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function formatTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function decodeSegment(value) {
  return decodeURIComponent(value);
}

function escapePgPassField(value) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

function readConnectionSettings(databaseUrl) {
  let url;

  try {
    url = new URL(databaseUrl);
  } catch {
    fail("DATABASE_URL must be a valid postgres connection string.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    fail("DATABASE_URL must use the postgres:// or postgresql:// protocol.");
  }

  const databaseName = decodeSegment(url.pathname.replace(/^\/+/, ""));

  if (!databaseName) {
    fail("DATABASE_URL must include a database name.");
  }

  return {
    databaseName,
    host: url.hostname || url.searchParams.get("host") || undefined,
    password: url.password ? decodeSegment(url.password) : undefined,
    port: url.port || url.searchParams.get("port") || undefined,
    searchParams: url.searchParams,
    username: url.username ? decodeSegment(url.username) : undefined,
  };
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  fail("DATABASE_URL is required to create a runtime backup.");
}

const connection = readConnectionSettings(databaseUrl);
const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR ?? "backups");
const backupPrefix = process.env.BACKUP_PREFIX?.trim() || "aussie-deal-hub";
const backupTimestamp = process.env.BACKUP_TIMESTAMP?.trim() || formatTimestamp(new Date());
const backupPath = path.join(backupDir, `${backupPrefix}-${backupTimestamp}.dump`);
const pgEnvironment = { ...process.env };

pgEnvironment.PGDATABASE = connection.databaseName;

if (connection.host) {
  pgEnvironment.PGHOST = connection.host;
}

if (connection.port) {
  pgEnvironment.PGPORT = connection.port;
}

if (connection.username) {
  pgEnvironment.PGUSER = connection.username;
}

const optionalEnvMappings = [
  ["sslmode", "PGSSLMODE"],
  ["sslcert", "PGSSLCERT"],
  ["sslkey", "PGSSLKEY"],
  ["sslrootcert", "PGSSLROOTCERT"],
  ["application_name", "PGAPPNAME"],
  ["connect_timeout", "PGCONNECT_TIMEOUT"],
  ["options", "PGOPTIONS"],
];

for (const [searchParam, envName] of optionalEnvMappings) {
  const value = connection.searchParams.get(searchParam);

  if (value) {
    pgEnvironment[envName] = value;
  }
}

mkdirSync(backupDir, { recursive: true });

let pgPassDirPath;

if (connection.password && connection.username) {
  pgPassDirPath = mkdtempSync(path.join(os.tmpdir(), "adh-pgpass-"));
  const pgPassFilePath = path.join(pgPassDirPath, ".pgpass");
  const pgPassEntry = [
    escapePgPassField(connection.host ?? "*"),
    escapePgPassField(connection.port ?? "*"),
    escapePgPassField(connection.databaseName),
    escapePgPassField(connection.username),
    escapePgPassField(connection.password),
  ].join(":");

  writeFileSync(pgPassFilePath, `${pgPassEntry}\n`, { mode: 0o600 });
  chmodSync(pgPassFilePath, 0o600);
  pgEnvironment.PGPASSFILE = pgPassFilePath;
  delete pgEnvironment.PGPASSWORD;
}

let result;

try {
  result = spawnSync(
    "pg_dump",
    ["--format=custom", "--no-owner", "--no-privileges", "--file", backupPath],
    {
      encoding: "utf8",
      env: pgEnvironment,
      stdio: ["ignore", "inherit", "pipe"],
    },
  );
} finally {
  if (pgPassDirPath) {
    rmSync(pgPassDirPath, { force: true, recursive: true });
  }
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
