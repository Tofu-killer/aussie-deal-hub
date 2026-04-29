import { runReadinessSmoke } from "../packages/config/src/readinessSmoke.ts";

import { pathToFileURL } from "node:url";

export function buildReadinessSmokeTargets(env = process.env) {
  return [
    {
      name: "api-health",
      url: env.API_HEALTH_URL ?? "http://127.0.0.1:3001/v1/health",
      expectedStatus: 200,
    },
    {
      name: "api-ready",
      url: env.API_READY_URL ?? "http://127.0.0.1:3001/v1/ready",
      expectedStatus: 200,
    },
    {
      name: "web-health",
      url: env.WEB_HEALTH_URL ?? "http://127.0.0.1:3000/health",
      expectedStatus: 200,
    },
    {
      name: "web-ready",
      url: env.WEB_READY_URL ?? "http://127.0.0.1:3000/ready",
      expectedStatus: 200,
    },
    {
      name: "admin-health",
      url: env.ADMIN_HEALTH_URL ?? "http://127.0.0.1:3002/health",
      expectedStatus: 200,
    },
    {
      name: "admin-ready",
      url: env.ADMIN_READY_URL ?? "http://127.0.0.1:3002/ready",
      expectedStatus: 200,
    },
    {
      name: "worker-runtime-ready",
      url: env.WORKER_RUNTIME_URL ?? "http://127.0.0.1:3001/v1/admin/runtime/worker",
      expectedStatus: 200,
    },
  ];
}

export async function runReadinessSmokeScript(env = process.env, runner = runReadinessSmoke) {
  await runner(buildReadinessSmokeTargets(env));
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runReadinessSmokeScript().catch((error) => {
    console.error("Readiness smoke failed:", error);
    process.exitCode = 1;
  });
}
