import { runReadinessSmoke } from "../packages/config/src/readinessSmoke.ts";

import { pathToFileURL } from "node:url";
import {
  READINESS_RUNTIME_TARGETS,
  resolveRuntimeTargetEnv,
  validateRuntimeTargets,
} from "./lib/runtime-targets.mjs";

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function buildReadinessSmokeTargets(env = process.env) {
  return [
    {
      name: "api-health",
      url: env.API_HEALTH_URL,
      expectedStatus: 200,
      expectedOk: true,
    },
    {
      name: "api-ready",
      url: env.API_READY_URL,
      expectedStatus: 200,
      expectedOk: true,
    },
    {
      name: "web-health",
      url: env.WEB_HEALTH_URL,
      expectedStatus: 200,
      expectedOk: true,
    },
    {
      name: "web-ready",
      url: env.WEB_READY_URL,
      expectedStatus: 200,
      expectedOk: true,
    },
    {
      name: "admin-health",
      url: env.ADMIN_HEALTH_URL,
      expectedStatus: 200,
      expectedOk: true,
    },
    {
      name: "admin-ready",
      url: env.ADMIN_READY_URL,
      expectedStatus: 200,
      expectedOk: true,
    },
    {
      name: "worker-runtime-ready",
      url: env.WORKER_RUNTIME_URL,
      expectedStatus: 200,
      expectedOk: true,
      requiredJson: {
        status: "ok",
      },
    },
  ];
}

export function buildReadinessSmokeOptions(env = process.env) {
  return {
    maxAttempts: readPositiveInteger(env.READINESS_SMOKE_MAX_ATTEMPTS, 10),
    delayMs: readNonNegativeInteger(env.READINESS_SMOKE_DELAY_MS, 1000),
  };
}

export async function runReadinessSmokeScript(env = process.env, runner = runReadinessSmoke) {
  const resolvedEnv = resolveRuntimeTargetEnv(env);
  validateRuntimeTargets(resolvedEnv, "smoke:readiness", READINESS_RUNTIME_TARGETS);
  await runner(buildReadinessSmokeTargets(resolvedEnv), buildReadinessSmokeOptions(resolvedEnv));
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runReadinessSmokeScript().catch((error) => {
    console.error("Readiness smoke failed:", error);
    process.exitCode = 1;
  });
}
