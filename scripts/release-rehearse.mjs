import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  resolveConfiguredBundleRoot,
  resolveNewestBundleRoot,
} from "./lib/release-bundle-root.mjs";

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
