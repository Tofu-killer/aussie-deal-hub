import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { fail } from "./postgres-runtime.mjs";

function readManifest(bundleRoot) {
  const manifestPath = path.join(bundleRoot, "release-manifest.json");

  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return undefined;
  }
}

function resolveBundleCandidates(rootDirectory) {
  return readdirSync(rootDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const bundleRoot = path.join(rootDirectory, entry.name);
      const manifest = readManifest(bundleRoot);

      if (!manifest?.createdAt) {
        return undefined;
      }

      return {
        bundleRoot,
        createdAt: manifest.createdAt,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function resolveConfiguredBundleRoot(cwd, configuredRoot) {
  const bundleRoot = path.resolve(cwd, configuredRoot);
  const manifestAtRoot = readManifest(bundleRoot);

  if (manifestAtRoot) {
    return bundleRoot;
  }

  try {
    const bundleCandidates = resolveBundleCandidates(bundleRoot);

    if (bundleCandidates.length > 0) {
      return bundleCandidates[0].bundleRoot;
    }
  } catch {
    // handled by the fail below
  }

  fail(`Could not find a release bundle manifest under ${configuredRoot}.`);
}

export function resolveNewestBundleRoot(cwd) {
  const releaseRoot = path.join(cwd, "release");

  try {
    const manifestAtRoot = readManifest(releaseRoot);

    if (manifestAtRoot) {
      return releaseRoot;
    }

    const bundleCandidates = resolveBundleCandidates(releaseRoot);

    if (bundleCandidates.length > 0) {
      return bundleCandidates[0].bundleRoot;
    }
  } catch {
    // handled by the fail below
  }

  fail(`Could not find a release bundle manifest under ${path.relative(cwd, releaseRoot) || "release"}.`);
}

export function readReleaseManifest(bundleRoot) {
  return readManifest(bundleRoot);
}
