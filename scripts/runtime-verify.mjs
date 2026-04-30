import { pathToFileURL } from "node:url";

import { runReadinessSmokeScript } from "./smoke-readiness.mjs";
import { runRouteSmokeScript } from "./smoke-routes.mjs";

const REQUIRED_RUNTIME_VERIFY_TARGETS = [
  "API_HEALTH_URL",
  "API_READY_URL",
  "API_PUBLIC_DEAL_URL",
  "WORKER_RUNTIME_URL",
  "WEB_HEALTH_URL",
  "WEB_READY_URL",
  "WEB_HOME_URL",
  "WEB_SEARCH_URL",
  "ADMIN_HEALTH_URL",
  "ADMIN_HOME_URL",
  "ADMIN_READY_URL",
];

function normalizeBaseUrl(rawValue) {
  const trimmedValue = rawValue?.trim();

  if (!trimmedValue) {
    return undefined;
  }

  return trimmedValue.replace(/\/+$/u, "");
}

function resolveLocale(rawValue) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue.replace(/^\/+|\/+$/gu, "") : "en";
}

function joinBaseUrl(baseUrl, suffix) {
  return `${baseUrl}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}

function setDefault(env, key, value) {
  if (env[key] === undefined && value !== undefined) {
    env[key] = value;
  }
}

export function resolveRuntimeVerifyEnv(env = process.env) {
  const resolvedEnv = { ...env };
  const apiBaseUrl = normalizeBaseUrl(env.RUNTIME_API_BASE_URL);
  const webBaseUrl = normalizeBaseUrl(env.RUNTIME_WEB_BASE_URL);
  const adminBaseUrl = normalizeBaseUrl(env.RUNTIME_ADMIN_BASE_URL);
  const locale = resolveLocale(env.RUNTIME_LOCALE);

  setDefault(resolvedEnv, "API_HEALTH_URL", apiBaseUrl && joinBaseUrl(apiBaseUrl, "/v1/health"));
  setDefault(resolvedEnv, "API_READY_URL", apiBaseUrl && joinBaseUrl(apiBaseUrl, "/v1/ready"));
  setDefault(
    resolvedEnv,
    "API_PUBLIC_DEAL_URL",
    apiBaseUrl && joinBaseUrl(apiBaseUrl, `/v1/public/deals/${locale}/nintendo-switch-oled-amazon-au`),
  );
  setDefault(
    resolvedEnv,
    "WORKER_RUNTIME_URL",
    apiBaseUrl && joinBaseUrl(apiBaseUrl, "/v1/admin/runtime/worker"),
  );
  setDefault(resolvedEnv, "WEB_HEALTH_URL", webBaseUrl && joinBaseUrl(webBaseUrl, "/health"));
  setDefault(resolvedEnv, "WEB_READY_URL", webBaseUrl && joinBaseUrl(webBaseUrl, "/ready"));
  setDefault(resolvedEnv, "WEB_HOME_URL", webBaseUrl && joinBaseUrl(webBaseUrl, `/${locale}`));
  setDefault(
    resolvedEnv,
    "WEB_SEARCH_URL",
    webBaseUrl && `${joinBaseUrl(webBaseUrl, `/${locale}/search`)}?q=switch`,
  );
  setDefault(resolvedEnv, "ADMIN_HEALTH_URL", adminBaseUrl && joinBaseUrl(adminBaseUrl, "/health"));
  setDefault(resolvedEnv, "ADMIN_READY_URL", adminBaseUrl && joinBaseUrl(adminBaseUrl, "/ready"));
  setDefault(resolvedEnv, "ADMIN_HOME_URL", adminBaseUrl);

  return resolvedEnv;
}

export function validateRuntimeVerifyEnv(env = process.env) {
  const missingTargets = REQUIRED_RUNTIME_VERIFY_TARGETS.filter((target) => {
    const value = env[target];

    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missingTargets.length > 0) {
    throw new Error(
      `runtime:verify requires complete target URLs. Missing: ${missingTargets.join(", ")}`,
    );
  }

  return env;
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
