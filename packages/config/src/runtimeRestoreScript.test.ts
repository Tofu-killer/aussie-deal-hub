import { spawnSync } from "node:child_process";
import { access, chmod, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/runtime-restore.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
});

async function createTempRepo() {
  const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-runtime-restore-"));
  tempDirs.push(tempRepoRoot);

  return tempRepoRoot;
}

async function installFakePgRestore(repoRootPath: string, captureFilePath: string) {
  const binDir = path.join(repoRootPath, "bin");
  const runnerPath = path.join(binDir, "pg_restore.js");
  const launcherPath = path.join(
    binDir,
    process.platform === "win32" ? "pg_restore.cmd" : "pg_restore",
  );
  const runnerContents = [
    "#!/usr/bin/env node",
    "const { readFileSync, writeFileSync } = require('node:fs');",
    "writeFileSync(process.env.CAPTURE_FILE, JSON.stringify({",
    "  cwd: process.cwd(),",
    "  argv: process.argv.slice(2),",
    "  env: {",
    "    PGDATABASE: process.env.PGDATABASE,",
    "    PGHOST: process.env.PGHOST,",
    "    PGPASSFILE: process.env.PGPASSFILE,",
    "    PGPASSWORD: process.env.PGPASSWORD,",
    "    PGPORT: process.env.PGPORT,",
    "    PGSSLMODE: process.env.PGSSLMODE,",
    "    PGUSER: process.env.PGUSER,",
    "  },",
    "  pgPassFileContents: process.env.PGPASSFILE ? readFileSync(process.env.PGPASSFILE, 'utf8') : undefined,",
    "}, null, 2));",
  ].join("\n");
  const launcherContents =
    process.platform === "win32"
      ? ['@echo off', 'node "%~dp0\\pg_restore.js" %*'].join("\r\n")
      : runnerContents;

  await mkdir(binDir, { recursive: true });
  await writeFile(runnerPath, runnerContents);
  await writeFile(launcherPath, launcherContents);

  if (process.platform !== "win32") {
    await chmod(launcherPath, 0o755);
  }

  return binDir;
}

describe("runtime restore script", () => {
  it("fails with a custom error when DATABASE_URL is missing", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: "backups/runtime.dump",
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("DATABASE_URL is required to restore a runtime backup.");
  });

  it("fails with a custom error when BACKUP_FILE is missing", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BACKUP_FILE is required to restore a runtime backup.");
  });

  it("requires an explicit confirmation gate before running pg_restore", async () => {
    const tempRepoRoot = await createTempRepo();
    const backupFilePath = path.join(tempRepoRoot, "backups", "runtime.dump");

    await mkdir(path.dirname(backupFilePath), { recursive: true });
    await writeFile(backupFilePath, "runtime-backup");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: path.join("backups", "runtime.dump"),
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "RESTORE_CONFIRM=restore is required before pnpm runtime:restore will modify the target database.",
    );
  });

  it("invokes pg_restore with stable flags, a resolved backup path, and libpq credentials", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pg-restore-invocation.json");
    const backupFilePath = path.join(tempRepoRoot, "artifacts", "runtime.dump");
    const binDir = await installFakePgRestore(tempRepoRoot, captureFilePath);

    await mkdir(path.dirname(backupFilePath), { recursive: true });
    await writeFile(backupFilePath, "runtime-backup");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: path.join("artifacts", "runtime.dump"),
        CAPTURE_FILE: captureFilePath,
        DATABASE_URL:
          "postgresql://postgres:super-secret@127.0.0.1:5432/aussie_deals_hub?sslmode=require",
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(path.join("artifacts", "runtime.dump"));

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
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--exit-on-error",
      await realpath(backupFilePath),
    ]);
    expect(capture.env).toMatchObject({
      PGDATABASE: "aussie_deals_hub",
      PGHOST: "127.0.0.1",
      PGPORT: "5432",
      PGSSLMODE: "require",
      PGUSER: "postgres",
    });
    expect(capture.env.PGPASSWORD).toBeUndefined();
    expect(capture.env.PGPASSFILE).toBeTruthy();
    expect(capture.pgPassFileContents).toBe(
      "127.0.0.1:5432:aussie_deals_hub:postgres:super-secret\n",
    );
  });

  it("prints a custom error when pg_restore is unavailable", async () => {
    const tempRepoRoot = await createTempRepo();
    const backupFilePath = path.join(tempRepoRoot, "backups", "runtime.dump");

    await mkdir(path.dirname(backupFilePath), { recursive: true });
    await writeFile(backupFilePath, "runtime-backup");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: path.join("backups", "runtime.dump"),
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: "",
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "pg_restore was not found in PATH. Install PostgreSQL client tools before running pnpm runtime:restore.",
    );
  });

  it("fails with a custom error when BACKUP_FILE does not exist", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: path.join("backups", "missing.dump"),
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BACKUP_FILE does not exist:");
    expect(result.stderr).toContain(path.join("backups", "missing.dump"));
  });

  it("rejects non-dump BACKUP_FILE artifacts", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pg-restore-invocation.json");
    const backupFilePath = path.join(tempRepoRoot, "backups", "runtime.sql");
    const binDir = await installFakePgRestore(tempRepoRoot, captureFilePath);

    await mkdir(path.dirname(backupFilePath), { recursive: true });
    await writeFile(backupFilePath, "runtime-backup");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: path.join("backups", "runtime.sql"),
        CAPTURE_FILE: captureFilePath,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "BACKUP_FILE must point to a custom-format .dump artifact created by pnpm runtime:backup.",
    );
  });

  it("rejects blank BACKUP_FILE values", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: "   ",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BACKUP_FILE is required to restore a runtime backup.");
  });

  it("accepts absolute BACKUP_FILE paths", async () => {
    const tempRepoRoot = await createTempRepo();
    const captureFilePath = path.join(tempRepoRoot, "pg-restore-invocation.json");
    const backupFilePath = path.join(tempRepoRoot, "runtime.dump");
    const binDir = await installFakePgRestore(tempRepoRoot, captureFilePath);

    await writeFile(backupFilePath, "runtime-backup");

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        BACKUP_FILE: backupFilePath,
        CAPTURE_FILE: captureFilePath,
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        RESTORE_CONFIRM: "restore",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    const capture = JSON.parse(await readFile(captureFilePath, "utf8")) as {
      argv: string[];
    };

    expect(capture.argv.at(-1)).toBe(await realpath(backupFilePath));
    await expect(access(backupFilePath)).resolves.toBeUndefined();
  });
});
