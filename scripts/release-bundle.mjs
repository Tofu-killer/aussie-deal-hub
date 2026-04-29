import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, formatTimestamp } from "./lib/postgres-runtime.mjs";

const releasePaths = [
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
];

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  "backups",
  "coverage",
  "dist",
  "node_modules",
  "release",
]);
const ignoredFileNames = new Set([".DS_Store"]);

function parseReleaseTimestamp(rawTimestamp) {
  const match = rawTimestamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);

  if (!match) {
    fail("RELEASE_TIMESTAMP must use the YYYYMMDDTHHMMSSZ format when provided.");
  }

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );

  return {
    date,
    timestamp: rawTimestamp,
  };
}

function resolveReleaseTiming() {
  const releaseTimestamp = process.env.RELEASE_TIMESTAMP?.trim();

  if (releaseTimestamp) {
    return parseReleaseTimestamp(releaseTimestamp);
  }

  const date = new Date();

  return {
    date,
    timestamp: formatTimestamp(date),
  };
}

function resolveGitSha() {
  const explicitGitSha = process.env.RELEASE_GIT_SHA?.trim();

  if (explicitGitSha) {
    return explicitGitSha;
  }

  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function shouldCopySource(repoRoot, sourcePath) {
  const relativePath = path.relative(repoRoot, sourcePath);

  if (!relativePath || relativePath === "") {
    return true;
  }

  const baseName = path.basename(sourcePath);

  if (ignoredFileNames.has(baseName)) {
    return false;
  }

  if (baseName.startsWith(".env") && relativePath !== ".env.example") {
    return false;
  }

  return !relativePath
    .split(path.sep)
    .some((segment) => ignoredDirectoryNames.has(segment));
}

const repoRoot = process.cwd();
const releaseRoot = path.resolve(repoRoot, process.env.RELEASE_DIR ?? "release");
const { date, timestamp } = resolveReleaseTiming();
const gitSha = resolveGitSha();
const shortGitSha = (gitSha === "unknown" ? gitSha : gitSha.slice(0, 12)) || "unknown";
const releaseName = `aussie-deal-hub-release-${timestamp}-${shortGitSha}`;
const bundleRoot = path.join(releaseRoot, releaseName);

if (existsSync(bundleRoot)) {
  fail(`Release bundle already exists at ${path.relative(repoRoot, bundleRoot)}.`);
}

mkdirSync(bundleRoot, { recursive: true });

for (const releasePath of releasePaths) {
  const sourcePath = path.join(repoRoot, releasePath);

  if (!existsSync(sourcePath)) {
    fail(`Required release bundle path is missing: ${releasePath}`);
  }

  const targetPath = path.join(bundleRoot, releasePath);

  cpSync(sourcePath, targetPath, {
    filter: (currentSourcePath) => shouldCopySource(repoRoot, currentSourcePath),
    recursive: true,
  });
}

const manifestPath = path.join(bundleRoot, "release-manifest.json");

writeFileSync(
  manifestPath,
  `${JSON.stringify(
    {
      createdAt: date.toISOString(),
      gitSha,
      includedPaths: releasePaths,
      releaseName,
    },
    null,
    2,
  )}\n`,
);

console.log(`Created release bundle at ${path.relative(repoRoot, bundleRoot)}`);
