import { pathToFileURL } from "node:url";

import {
  resolveRouteSmokeRuntimeOptions,
  runRouteSmoke,
} from "../packages/config/src/routeSmoke.ts";

const defaultPublicDealSlug = "nintendo-switch-oled-amazon-au";
const defaultPublicDealLocale = "en";
const defaultPublicDealUrl =
  "http://127.0.0.1:3001/v1/public/deals/en/nintendo-switch-oled-amazon-au";

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
      name: "api-public-deal-en",
      url: env.API_PUBLIC_DEAL_URL ?? defaultPublicDealUrl,
      expectedStatus: 200,
      requiredJson: {
        locale: defaultPublicDealLocale,
        slug: defaultPublicDealSlug,
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
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
