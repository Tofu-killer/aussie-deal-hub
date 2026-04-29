import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export function formatTimestamp(date) {
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

export function createPostgresRuntimeEnvironment(databaseUrl) {
  const connection = readConnectionSettings(databaseUrl);
  const environment = { ...process.env };

  environment.PGDATABASE = connection.databaseName;

  if (connection.host) {
    environment.PGHOST = connection.host;
  }

  if (connection.port) {
    environment.PGPORT = connection.port;
  }

  if (connection.username) {
    environment.PGUSER = connection.username;
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
      environment[envName] = value;
    }
  }

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
    environment.PGPASSFILE = pgPassFilePath;
    delete environment.PGPASSWORD;
  }

  return {
    environment,
    cleanup() {
      if (pgPassDirPath) {
        rmSync(pgPassDirPath, { force: true, recursive: true });
      }
    },
  };
}
