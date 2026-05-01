import { pathToFileURL } from "node:url";

import {
  resolveRouteSmokeRuntimeOptions,
  runRouteSmoke,
} from "../packages/config/src/routeSmoke.ts";
import {
  ROUTE_RUNTIME_TARGETS,
  resolveRuntimeTargetEnv,
  validateRuntimeTargets,
} from "./lib/runtime-targets.mjs";

export function buildRouteSmokeTargets(env = process.env) {
  return [
    {
      name: "web-home-en",
      url: env.WEB_HOME_URL,
      expectedStatus: 200,
      requiredText: ["Latest deals", "Trending merchants", "Open Favorites"],
    },
    {
      name: "web-search-en",
      url: env.WEB_SEARCH_URL,
      expectedStatus: 200,
      requiredText: ["Search results", "Search deals", "switch"],
    },
    {
      name: "admin-home",
      url: env.ADMIN_HOME_URL,
      expectedStatus: 200,
      requiredText: ["Admin review dashboard", "Live summary", "Workflow shortcuts"],
    },
    {
      name: "api-public-deals-en",
      url: env.API_PUBLIC_DEALS_URL,
      expectedStatus: 200,
      requiredJson: {
        items: [],
      },
    },
    {
      name: "api-public-deal-missing-en",
      url: env.API_PUBLIC_DEAL_URL,
      expectedStatus: 404,
      requiredJson: {
        message: "Deal not found.",
      },
    },
  ];
}

export async function runRouteSmokeScript(env = process.env, runner = runRouteSmoke) {
  const resolvedEnv = resolveRuntimeTargetEnv(env);
  validateRuntimeTargets(resolvedEnv, "smoke:routes", ROUTE_RUNTIME_TARGETS);
  const { totalTimeoutMs, delayMs } = resolveRouteSmokeRuntimeOptions(env);

  await runner(buildRouteSmokeTargets(resolvedEnv), {
    totalTimeoutMs,
    delayMs,
  });
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  runRouteSmokeScript().catch((error) => {
    console.error("Route smoke failed:", error);
    process.exitCode = 1;
  });
}
