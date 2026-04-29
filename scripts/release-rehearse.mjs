import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { fail } from "./lib/postgres-runtime.mjs";

function readManifest(bundleRoot) {
  const manifestPath = path.join(bundleRoot, "release-manifest.json");

  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return undefined;
  }
}

function resolveConfiguredBundleRoot(cwd, configuredRoot) {
  const bundleRoot = path.resolve(cwd, configuredRoot);
  const manifest = readManifest(bundleRoot);

  if (!manifest) {
    fail(`Could not find a release bundle manifest under ${configuredRoot}.`);
  }

  return bundleRoot;
}

function resolveNewestBundleRoot(cwd) {
  const releaseRoot = path.join(cwd, "release");

  try {
    const manifestAtRoot = readManifest(releaseRoot);

    if (manifestAtRoot) {
      return releaseRoot;
    }

    const bundleCandidates = readdirSync(releaseRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const bundleRoot = path.join(releaseRoot, entry.name);
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

    if (bundleCandidates.length > 0) {
      return bundleCandidates[0].bundleRoot;
    }
  } catch {
    // handled by the fail below
  }

  fail(`Could not find a release bundle manifest under ${path.relative(cwd, releaseRoot) || "release"}.`);
}

function resolveReleaseRehearseRoot(cwd = process.cwd(), env = process.env) {
  const configuredRoot = env.RELEASE_REHEARSE_ROOT?.trim();

  if (configuredRoot) {
    return resolveConfiguredBundleRoot(cwd, configuredRoot);
  }

  return resolveNewestBundleRoot(cwd);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
    stdio: ["ignore", "inherit", "pipe"],
  });

  if (result.error) {
    throw result.error;
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    const renderedCommand = [command, ...args].join(" ");
    throw new Error(`Command failed (${result.status ?? 1}): ${renderedCommand}`);
  }
}

export async function runReleaseRehearseScript(cwd = process.cwd(), env = process.env) {
  const bundleRoot = resolveReleaseRehearseRoot(cwd, env);
  let stackAttempted = false;
  let failed = false;

  console.log(`Rehearsing release bundle at ${path.relative(cwd, bundleRoot) || "."}`);

  try {
    runCommand("pnpm", ["install", "--frozen-lockfile"], { cwd: bundleRoot, env });
    stackAttempted = true;
    runCommand("docker", ["compose", "up", "-d", "--build"], { cwd: bundleRoot, env });
    runCommand("pnpm", ["smoke:container-health"], { cwd: bundleRoot, env });
    runCommand("pnpm", ["smoke:readiness"], { cwd: bundleRoot, env });
    runCommand("pnpm", ["smoke:routes"], { cwd: bundleRoot, env });
  } catch (error) {
    failed = true;

    if (stackAttempted) {
      try {
        runCommand(
          "docker",
          ["compose", "logs", "postgres", "redis", "db-init", "api", "web", "admin", "worker"],
          { cwd: bundleRoot, env },
        );
      } catch {
        // best-effort diagnostics
      }
    }

    throw error;
  } finally {
    if (stackAttempted) {
      try {
        runCommand("docker", ["compose", "down", "-v"], { cwd: bundleRoot, env });
      } catch (error) {
        if (!failed) {
          throw error;
        }
      }
    }
  }
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runReleaseRehearseScript().catch((error) => {
    console.error("Release rehearse failed:", error);
    process.exitCode = 1;
  });
}
