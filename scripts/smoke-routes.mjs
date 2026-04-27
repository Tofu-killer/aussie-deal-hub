import { pathToFileURL } from "node:url";

import {
  resolveRouteSmokeRuntimeOptions,
  runRouteSmoke,
} from "../packages/config/src/routeSmoke.ts";

export function buildRouteSmokeTargets(env = process.env) {
  return [
    {
      name: "web-home-en",
      url: env.WEB_HOME_URL ?? "http://127.0.0.1:3000/en",
      expectedStatus: 200,
      requiredText: ["Latest deals", "Trending merchants", "Open Favorites"],
    },
    {
      name: "web-search-en",
      url: env.WEB_SEARCH_URL ?? "http://127.0.0.1:3000/en/search?q=switch",
      expectedStatus: 200,
      requiredText: ["Search results", "Search deals", "switch"],
    },
    {
      name: "admin-home",
      url: env.ADMIN_HOME_URL ?? "http://127.0.0.1:3002/",
      expectedStatus: 200,
      requiredText: ["Admin review dashboard", "Live summary", "Workflow shortcuts"],
    },
  ];
}

export async function runRouteSmokeScript(env = process.env, runner = runRouteSmoke) {
  const { totalTimeoutMs, delayMs } = resolveRouteSmokeRuntimeOptions(env);

  await runner(buildRouteSmokeTargets(env), {
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
