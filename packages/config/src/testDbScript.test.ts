import { spawnSync } from "node:child_process";
import { access, chmod, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/test-db.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
});

async function createTempRepo() {
  const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-test-db-"));
  tempDirs.push(tempRepoRoot);

  await mkdir(path.join(tempRepoRoot, "apps/api/tests"), { recursive: true });

  return tempRepoRoot;
}

async function writeRepoFile(repoRootPath: string, relativePath: string, contents: string) {
  const absolutePath = path.join(repoRootPath, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

async function installFakePnpm(repoRootPath: string, captureFilePath: string) {
  const binDir = path.join(repoRootPath, "bin");
  const pnpmPath = path.join(binDir, process.platform === "win32" ? "pnpm.cmd" : "pnpm");
  const scriptContents =
    process.platform === "win32"
      ? [
          "@echo off",
          "node -e \"require('node:fs').writeFileSync(process.env.CAPTURE_FILE, JSON.stringify({ cwd: process.cwd(), argv: process.argv.slice(1), env: { DATABASE_URL: process.env.DATABASE_URL, RUN_DB_TESTS: process.env.RUN_DB_TESTS } }, null, 2))\" %*",
        ].join("\r\n")
      : [
          "#!/usr/bin/env node",
          "const { writeFileSync } = require('node:fs');",
          "writeFileSync(process.env.CAPTURE_FILE, JSON.stringify({",
          "  cwd: process.cwd(),",
          "  argv: process.argv.slice(2),",
          "  env: {",
          "    DATABASE_URL: process.env.DATABASE_URL,",
          "    RUN_DB_TESTS: process.env.RUN_DB_TESTS,",
          "  },",
          "}, null, 2));",
        ].join("\n");

  await mkdir(binDir, { recursive: true });
  await writeFile(pnpmPath, scriptContents);

  if (process.platform !== "win32") {
    await chmod(pnpmPath, 0o755);
  }

  return binDir;
}

describe("test-db script", () => {
  it("discovers db-backed api tests from RUN_DB_TESTS and describeDb markers", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pnpm-invocation.json");
    const binDir = await installFakePnpm(tempRepoRoot, captureFilePath);

    await Promise.all([
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/zeta.persistence.test.ts",
        'const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;\n' +
          'describeDb("zeta persistence", () => {});\n',
      ),
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/alpha.test.ts",
        'const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;\n' +
          'describeDb("alpha persistence", () => {});\n',
      ),
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/nested/beta.test.ts",
        'describeDb("beta persistence", () => {});\n',
      ),
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/plain.test.ts",
        'describe("plain api test", () => {});\n',
      ),
      writeRepoFile(tempRepoRoot, "apps/api/tests/helpers.ts", "export const helper = true;\n"),
    ]);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        CAPTURE_FILE: captureFilePath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
      cwd: string;
      env: { DATABASE_URL?: string; RUN_DB_TESTS?: string };
    };

    expect(await realpath(capture.cwd)).toBe(await realpath(tempRepoRoot));
    expect(capture.env.RUN_DB_TESTS).toBe("1");
    expect(capture.argv).toEqual([
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      "--config",
      "vitest.workspace.ts",
      "apps/api/tests/alpha.test.ts",
      "apps/api/tests/nested/beta.test.ts",
      "apps/api/tests/zeta.persistence.test.ts",
    ]);
  });

  it("ignores RUN_DB_TESTS when it only appears in comments or strings", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pnpm-invocation.json");
    const binDir = await installFakePnpm(tempRepoRoot, captureFilePath);

    await Promise.all([
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/comment-only.test.ts",
        '// RUN_DB_TESTS should not opt this file into DB execution.\n' +
          'describe("comment only", () => {});\n',
      ),
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/string-only.test.ts",
        'const marker = "RUN_DB_TESTS";\n' + 'describe("string only", () => { expect(marker).toBeDefined(); });\n',
      ),
    ]);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        CAPTURE_FILE: captureFilePath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "No DB-backed tests were discovered under apps/api/tests. Expected describeDb suites.",
    );
    await expect(access(captureFilePath)).rejects.toThrow();
  });

  it("prints a custom error when apps/api/tests is missing", async () => {
    const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-test-db-missing-"));
    tempDirs.push(tempRepoRoot);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: process.env,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DB test directory not found: apps/api/tests");
    expect(result.stderr).not.toContain("ENOENT");
  });

  it("does not include files that only read RUN_DB_TESTS without defining a DB suite", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pnpm-invocation.json");
    const binDir = await installFakePnpm(tempRepoRoot, captureFilePath);

    await Promise.all([
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/env-only.test.ts",
        'const enabled = process.env.RUN_DB_TESTS === "1";\n' +
          'describe("plain env check", () => { expect(enabled).toBeTypeOf("boolean"); });\n',
      ),
      writeRepoFile(
        tempRepoRoot,
        "apps/api/tests/real-db.test.ts",
        'const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;\n' +
          'describeDb("real db suite", () => {});\n',
      ),
    ]);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        CAPTURE_FILE: captureFilePath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
    };

    expect(capture.argv).toEqual([
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      "--config",
      "vitest.workspace.ts",
      "apps/api/tests/real-db.test.ts",
    ]);
  });

  it("keeps discovering describeDb suites in tsx files with JSX text", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pnpm-invocation.json");
    const binDir = await installFakePnpm(tempRepoRoot, captureFilePath);

    await writeRepoFile(
      tempRepoRoot,
      "apps/api/tests/tsx-db.test.tsx",
      'const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;\n' +
        'const Example = () => <span>Docs: http://example.test/path</span>;\n' +
        'describeDb("tsx db suite", () => { expect(Example).toBeTypeOf("function"); });\n',
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        CAPTURE_FILE: captureFilePath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
    };

    expect(capture.argv).toEqual([
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      "--config",
      "vitest.workspace.ts",
      "apps/api/tests/tsx-db.test.tsx",
    ]);
  });

  it("keeps the current repository DB-backed test contract discoverable", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "adh-test-db-contract-"));
    tempDirs.push(tempDir);

    const captureFilePath = path.join(tempDir, "pnpm-invocation.json");
    const binDir = await installFakePnpm(tempDir, captureFilePath);

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        CAPTURE_FILE: captureFilePath,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
      cwd: string;
    };

    expect(await realpath(capture.cwd)).toBe(await realpath(repoRoot));
    expect(capture.argv).toEqual([
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      "--config",
      "vitest.workspace.ts",
      "apps/api/tests/adminCatalog.persistence.test.ts",
      "apps/api/tests/adminLeads.test.ts",
      "apps/api/tests/adminPublishing.test.ts",
      "apps/api/tests/adminSnapshots.test.ts",
      "apps/api/tests/adminSources.persistence.test.ts",
      "apps/api/tests/adminTopics.persistence.test.ts",
      "apps/api/tests/digestSubscriptions.persistence.test.ts",
      "apps/api/tests/favorites.persistence.test.ts",
      "apps/api/tests/publicDealPriceContext.test.ts",
    ]);
  });
});
