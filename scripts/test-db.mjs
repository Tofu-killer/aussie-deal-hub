import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const defaultLocalDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub";
const localDatabaseUrlFallbackEnvName = "ALLOW_LOCAL_DATABASE_URL_FALLBACK";
const testFilePattern = /\.test\.[cm]?[jt]sx?$/;
const missingTestsDirectoryMessage = "DB test directory not found: apps/api/tests";
const noDbTestsDiscoveredMessage =
  "No DB-backed tests were discovered under apps/api/tests. Expected describeDb suites.";

function normalizeEnvValue(rawValue) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function parseBooleanEnv(rawValue) {
  const normalizedValue = normalizeEnvValue(rawValue)?.toLowerCase();

  if (normalizedValue === undefined) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(normalizedValue);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveDatabaseUrl(env = process.env) {
  const configuredDatabaseUrl = normalizeEnvValue(env.DATABASE_URL);

  if (configuredDatabaseUrl) {
    return configuredDatabaseUrl;
  }

  if (parseBooleanEnv(env[localDatabaseUrlFallbackEnvName])) {
    return defaultLocalDatabaseUrl;
  }

  fail(
    `test:db requires DATABASE_URL. Set ${localDatabaseUrlFallbackEnvName}=1 to opt into ${defaultLocalDatabaseUrl} for local-only development.`,
  );
}

function listFiles(directoryPath) {
  const discoveredFiles = [];

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      discoveredFiles.push(...listFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      discoveredFiles.push(entryPath);
    }
  }

  return discoveredFiles;
}

function getScriptKind(filePath) {
  switch (path.extname(filePath)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".ts":
    case ".mts":
    case ".cts":
      return ts.ScriptKind.TS;
    default:
      return ts.ScriptKind.JS;
  }
}

function hasDescribeDbSuite(filePath, source) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );
  let foundDescribeDb = false;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "describeDb"
    ) {
      foundDescribeDb = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return foundDescribeDb;
}

function discoverDbTestFiles(repoRoot) {
  const testsRoot = path.join(repoRoot, "apps/api/tests");

  if (!existsSync(testsRoot)) {
    console.error(missingTestsDirectoryMessage);
    process.exit(1);
  }

  return listFiles(testsRoot)
    .filter((filePath) => testFilePattern.test(filePath))
    .map((filePath) => path.relative(repoRoot, filePath))
    .filter((filePath) => {
      const source = readFileSync(path.join(repoRoot, filePath), "utf8");

      return hasDescribeDbSuite(filePath, source);
    })
    .map((filePath) => filePath.split(path.sep).join("/"))
    .sort((left, right) => left.localeCompare(right));
}

const testFiles = discoverDbTestFiles(process.cwd());

if (testFiles.length === 0) {
  console.error(noDbTestsDiscoveredMessage);
  process.exit(1);
}

const databaseUrl = resolveDatabaseUrl(process.env);

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "--no-file-parallelism",
    "--config",
    "vitest.config.ts",
    ...testFiles,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      RUN_DB_TESTS: "1",
    },
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
