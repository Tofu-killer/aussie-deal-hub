import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub";
const testFilePattern = /\.test\.[cm]?[jt]sx?$/;
const missingTestsDirectoryMessage = "DB test directory not found: apps/api/tests";
const noDbTestsDiscoveredMessage =
  "No DB-backed tests were discovered under apps/api/tests. Expected describeDb suites.";

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

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  [
    "exec",
    "vitest",
    "run",
    "--config",
    "vitest.workspace.ts",
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
