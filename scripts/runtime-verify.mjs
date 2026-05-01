import { pathToFileURL } from "node:url";

import { runReadinessSmokeScript } from "./smoke-readiness.mjs";
import { runRouteSmokeScript } from "./smoke-routes.mjs";
import {
  resolveRuntimeTargetEnv,
  validateRuntimeTargets,
} from "./lib/runtime-targets.mjs";

export function resolveRuntimeVerifyEnv(env = process.env) {
  return resolveRuntimeTargetEnv(env);
}

export function validateRuntimeVerifyEnv(env = process.env) {
  return validateRuntimeTargets(env, "runtime:verify");
}

export async function runRuntimeVerifyScript(
  env = process.env,
  dependencies = {},
) {
  const { readinessRunner = runReadinessSmokeScript, routeRunner = runRouteSmokeScript } =
    dependencies;
  const resolvedEnv = resolveRuntimeVerifyEnv(env);
  validateRuntimeVerifyEnv(resolvedEnv);

  await readinessRunner(resolvedEnv);
  await routeRunner(resolvedEnv);
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runRuntimeVerifyScript().catch((error) => {
    console.error("Runtime verify failed:", error);
    process.exitCode = 1;
  });
}
