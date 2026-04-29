import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/release-bundle.mjs");
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })),
  );
});

async function createTempRepo() {
  const tempRepoRoot = await mkdtemp(path.join(os.tmpdir(), "adh-release-bundle-"));
  tempDirs.push(tempRepoRoot);

  await writeFile(path.join(tempRepoRoot, ".env.example"), "NEXT_PUBLIC_SITE_URL=https://example.test\n");
  await writeFile(path.join(tempRepoRoot, ".dockerignore"), "node_modules\n.next\n");
  await writeFile(path.join(tempRepoRoot, ".env"), "DATABASE_URL=postgresql://secret\n");
  await writeFile(path.join(tempRepoRoot, "README.md"), "# Temporary release bundle repo\n");
  await writeFile(path.join(tempRepoRoot, "Dockerfile"), "FROM node:22\n");
  await writeFile(path.join(tempRepoRoot, "docker-compose.yml"), "services:\n  api:\n    image: example\n");
  await writeFile(path.join(tempRepoRoot, "package.json"), JSON.stringify({ name: "temp-repo" }, null, 2));
  await writeFile(path.join(tempRepoRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await writeFile(path.join(tempRepoRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
  await writeFile(path.join(tempRepoRoot, "tsconfig.base.json"), JSON.stringify({}, null, 2));
  await writeFile(path.join(tempRepoRoot, "vitest.workspace.ts"), "export default [];\n");

  await mkdir(path.join(tempRepoRoot, "apps", "web", "src"), { recursive: true });
  await writeFile(path.join(tempRepoRoot, "apps", "web", "src", "index.ts"), "export const web = true;\n");
  await writeFile(path.join(tempRepoRoot, "apps", "web", ".env.local"), "SECRET_TOKEN=hidden\n");
  await mkdir(path.join(tempRepoRoot, "apps", "web", ".next"), { recursive: true });
  await writeFile(path.join(tempRepoRoot, "apps", "web", ".next", "build.txt"), "generated\n");

  await mkdir(path.join(tempRepoRoot, "packages", "config", "src"), { recursive: true });
  await writeFile(
    path.join(tempRepoRoot, "packages", "config", "src", "env.ts"),
    "export const env = true;\n",
  );
  await mkdir(path.join(tempRepoRoot, "packages", "config", "coverage"), { recursive: true });
  await writeFile(path.join(tempRepoRoot, "packages", "config", "coverage", "report.txt"), "generated\n");

  await mkdir(path.join(tempRepoRoot, "scripts"), { recursive: true });
  await writeFile(path.join(tempRepoRoot, "scripts", "smoke-readiness.mjs"), "console.log('ok');\n");

  await mkdir(path.join(tempRepoRoot, "backups"), { recursive: true });
  await writeFile(path.join(tempRepoRoot, "backups", "runtime.dump"), "runtime-backup\n");

  return tempRepoRoot;
}

describe("release bundle script", () => {
  it("creates a release directory with the curated deployment bundle and manifest", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        RELEASE_GIT_SHA: "abcdef1234567890",
        RELEASE_TIMESTAMP: "20260429T121314Z",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      path.join("release", "aussie-deal-hub-release-20260429T121314Z-abcdef123456"),
    );

    const bundleRoot = path.join(
      tempRepoRoot,
      "release",
      "aussie-deal-hub-release-20260429T121314Z-abcdef123456",
    );
    const manifestPath = path.join(bundleRoot, "release-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      createdAt: string;
      gitSha: string;
      includedPaths: string[];
      releaseName: string;
    };

    expect(manifest.releaseName).toBe("aussie-deal-hub-release-20260429T121314Z-abcdef123456");
    expect(manifest.createdAt).toBe("2026-04-29T12:13:14.000Z");
    expect(manifest.gitSha).toBe("abcdef1234567890");
    expect(manifest.includedPaths).toEqual([
      ".env.example",
      ".dockerignore",
      "README.md",
      "Dockerfile",
      "docker-compose.yml",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tsconfig.base.json",
      "vitest.workspace.ts",
      "apps",
      "packages",
      "scripts",
    ]);

    await expect(access(path.join(bundleRoot, ".env.example"))).resolves.toBeUndefined();
    await expect(access(path.join(bundleRoot, ".dockerignore"))).resolves.toBeUndefined();
    await expect(access(path.join(bundleRoot, "apps", "web", "src", "index.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(bundleRoot, "packages", "config", "src", "env.ts"))).resolves.toBeUndefined();
    await expect(access(path.join(bundleRoot, "scripts", "smoke-readiness.mjs"))).resolves.toBeUndefined();
    await expect(access(path.join(bundleRoot, ".env"))).rejects.toThrow();
    await expect(access(path.join(bundleRoot, "apps", "web", ".env.local"))).rejects.toThrow();
    await expect(access(path.join(bundleRoot, "apps", "web", ".next", "build.txt"))).rejects.toThrow();
    await expect(access(path.join(bundleRoot, "packages", "config", "coverage", "report.txt"))).rejects.toThrow();
    await expect(access(path.join(bundleRoot, "backups", "runtime.dump"))).rejects.toThrow();
  });

  it("supports a RELEASE_DIR override", async () => {
    const tempRepoRoot = await createTempRepo();

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        RELEASE_DIR: path.join("artifacts", "bundle"),
        RELEASE_GIT_SHA: "fedcba9876543210",
        RELEASE_TIMESTAMP: "20260429T222324Z",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(0);

    await expect(
      access(
        path.join(
          tempRepoRoot,
          "artifacts",
          "bundle",
          "aussie-deal-hub-release-20260429T222324Z-fedcba987654",
          "release-manifest.json",
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it("fails when a required release path is missing", async () => {
    const tempRepoRoot = await createTempRepo();
    await rm(path.join(tempRepoRoot, "docker-compose.yml"));

    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: tempRepoRoot,
      env: {
        ...process.env,
        RELEASE_GIT_SHA: "abcdef1234567890",
        RELEASE_TIMESTAMP: "20260429T121314Z",
      },
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Required release bundle path is missing: docker-compose.yml",
    );
  });
});
