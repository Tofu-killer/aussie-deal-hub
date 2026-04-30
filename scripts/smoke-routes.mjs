import { pathToFileURL } from "node:url";

import {
  resolveRouteSmokeRuntimeOptions,
  runRouteSmoke,
} from "../packages/config/src/routeSmoke.ts";

const defaultPublicDealLocale = "en";
const defaultPublicDealsUrl = "http://127.0.0.1:3001/v1/public/deals/en";
const defaultMissingPublicDealSlug = "route-smoke-missing-deal";
const defaultMissingPublicDealUrl =
  `${defaultPublicDealsUrl}/${defaultMissingPublicDealSlug}`;

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
    {
      name: "api-public-deals-en",
      url: env.API_PUBLIC_DEALS_URL ?? defaultPublicDealsUrl,
      expectedStatus: 200,
      requiredJson: {
        items: [],
      },
    },
    {
      name: "api-public-deal-missing-en",
      url: env.API_PUBLIC_DEAL_URL ?? defaultMissingPublicDealUrl,
      expectedStatus: 404,
      requiredJson: {
        message: "Deal not found.",
      },
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
