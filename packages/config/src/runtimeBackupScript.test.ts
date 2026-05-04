import { spawnSync } from "node:child_process";
import { access, chmod, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/runtime-backup.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
});

async function createTempRepo() {
  const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-runtime-backup-"));
  tempDirs.push(tempRepoRoot);

  return tempRepoRoot;
}

async function installFakePgDump(repoRootPath: string, captureFilePath: string) {
  const binDir = path.join(repoRootPath, "bin");
  const runnerPath = path.join(binDir, "pg_dump.js");
  const launcherPath = path.join(binDir, process.platform === "win32" ? "pg_dump.cmd" : "pg_dump");
  const runnerContents = [
    "#!/usr/bin/env node",
    "const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');",
    "const path = require('node:path');",
    "const args = process.argv.slice(2);",
    "function readOptionValue(name) {",
    "  const inlineValue = args.find((arg) => arg.startsWith(`${name}=`));",
    "  if (inlineValue) {",
    "    return inlineValue.slice(name.length + 1);",
    "  }",
    "  const index = args.indexOf(name);",
    "  return index === -1 ? undefined : args[index + 1];",
    "}",
    "const backupPath = readOptionValue('--file');",
    "if (backupPath) {",
    "  mkdirSync(path.dirname(backupPath), { recursive: true });",
    "  writeFileSync(backupPath, 'runtime-backup');",
    "}",
    "const pgPassFilePath = process.env.PGPASSFILE;",
    "writeFileSync(process.env.CAPTURE_FILE, JSON.stringify({",
    "  cwd: process.cwd(),",
    "  argv: args,",
    "  env: {",
    "    PGDATABASE: process.env.PGDATABASE,",
    "    PGHOST: process.env.PGHOST,",
    "    PGPASSFILE: pgPassFilePath,",
    "    PGPASSWORD: process.env.PGPASSWORD,",
    "    PGPORT: process.env.PGPORT,",
    "    PGSSLMODE: process.env.PGSSLMODE,",
    "    PGUSER: process.env.PGUSER,",
    "  },",
    "  pgPassFileContents: pgPassFilePath ? readFileSync(pgPassFilePath, 'utf8') : undefined,",
    "}, null, 2));",
  ].join("\n");
  const launcherContents =
    process.platform === "win32"
      ? ['@echo off', 'node "%~dp0\\pg_dump.js" %*'].join("\r\n")
      : runnerContents;

  await mkdir(binDir, { recursive: true });
  await writeFile(runnerPath, runnerContents);
  await writeFile(launcherPath, launcherContents);

  if (process.platform !== "win32") {
    await chmod(launcherPath, 0o755);
  }

  return binDir;
}

describe("runtime backup script", () => {
  it("fails with a custom error when DATABASE_URL is missing", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: process.env,
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is required to create a runtime backup.");
  });

  it("invokes pg_dump with the default backup path and stable flags", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pg-dump-invocation.json");
    const binDir = await installFakePgDump(tempRepoRoot, captureFilePath);
    const expectedBackupPath = path.join(
      tempRepoRoot,
      "backups",
      "aussie-deal-hub-20260429T101112Z.dump",
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_TIMESTAMP: "20260429T101112Z",
        CAPTURE_FILE: captureFilePath,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.join("backups", "aussie-deal-hub-20260429T101112Z.dump"));

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
      cwd: string;
      env: {
        PGDATABASE?: string;
        PGHOST?: string;
        PGPASSFILE?: string;
        PGPASSWORD?: string;
        PGPORT?: string;
        PGSSLMODE?: string;
        PGUSER?: string;
      };
      pgPassFileContents?: string;
    };

    expect(await realpath(capture.cwd)).toBe(await realpath(tempRepoRoot));
    expect(capture.argv).toEqual([
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      await realpath(expectedBackupPath),
    ]);
    expect(capture.env).toMatchObject({
      PGDATABASE: "aussie_deals_hub",
      PGHOST: "127.0.0.1",
      PGPORT: "5432",
      PGUSER: "postgres",
    });
    expect(capture.env.PGPASSWORD).toBeUndefined();
    expect(capture.env.PGPASSFILE).toBeTruthy();
    expect(capture.pgPassFileContents).toBe("127.0.0.1:5432:aussie_deals_hub:postgres:postgres\n");
    await expect(access(expectedBackupPath)).resolves.toBeUndefined();
  });

  it("supports backup directory and prefix overrides", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pg-dump-invocation.json");
    const binDir = await installFakePgDump(tempRepoRoot, captureFilePath);
    const expectedBackupPath = path.join(
      tempRepoRoot,
      "artifacts",
      "db",
      "nightly-20260429T202122Z.dump",
    );

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_DIR: path.join("artifacts", "db"),
        BACKUP_PREFIX: "nightly",
        BACKUP_TIMESTAMP: "20260429T202122Z",
        CAPTURE_FILE: captureFilePath,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
      env: { PGPASSFILE?: string };
      pgPassFileContents?: string;
    };

    expect(capture.argv[4]).toBe(await realpath(expectedBackupPath));
    expect(capture.env.PGPASSFILE).toBeTruthy();
    expect(capture.pgPassFileContents).toBe("127.0.0.1:5432:aussie_deals_hub:postgres:postgres\n");
    await expect(access(expectedBackupPath)).resolves.toBeUndefined();
  });

  it("rejects BACKUP_FILE values that do not end in .dump", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: path.join("artifacts", "runtime.sql"),
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: "",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "BACKUP_FILE must point to a custom-format .dump artifact path for pnpm runtime:backup.",
    );
  });

  it("prints a custom error when pg_dump is unavailable", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: "",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "pg_dump was not found in PATH. Install PostgreSQL client tools before running pnpm runtime:backup.",
    );
  });
});
