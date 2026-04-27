import { runRouteSmoke } from "../packages/config/src/routeSmoke.ts";

function readPositiveIntegerEnv(name, fallbackValue) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

const targets = [
  {
    name: "web-home-en",
    url: process.env.WEB_HOME_URL ?? "http://127.0.0.1:3000/en",
    expectedStatus: 200,
    requiredText: ["Latest deals", "Trending merchants", "Open Favorites"],
  },
  {
    name: "web-search-en",
    url: process.env.WEB_SEARCH_URL ?? "http://127.0.0.1:3000/en/search?q=switch",
    expectedStatus: 200,
    requiredText: ["Search results", "Search deals", "switch"],
  },
  {
    name: "admin-home",
    url: process.env.ADMIN_HOME_URL ?? "http://127.0.0.1:3002/",
    expectedStatus: 200,
    requiredText: ["Admin review dashboard", "Live summary", "Workflow shortcuts"],
  },
];

async function main() {
  const timeoutMs = readPositiveIntegerEnv("ROUTE_SMOKE_TIMEOUT_MS", 10_000);
  const pollIntervalMs = readPositiveIntegerEnv("ROUTE_SMOKE_POLL_INTERVAL_MS", 1_000);

  await runRouteSmoke(targets, {
    maxAttempts: Math.max(1, Math.ceil(timeoutMs / pollIntervalMs)),
    delayMs: pollIntervalMs,
  });
}

main().catch((error) => {
  console.error("Route smoke failed:", error);
  process.exitCode = 1;
});
