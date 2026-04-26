import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

import {
  evaluateComposeRuntimeHealth,
  formatPendingComposeServices,
  parseComposePsOutput,
} from "../packages/config/src/composeRuntimeHealth.ts";

function readPositiveIntegerEnv(name, fallbackValue) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function readRequiredServices() {
  const rawValue = process.env.COMPOSE_HEALTH_SERVICES;

  if (!rawValue) {
    return ["api", "web", "admin", "worker"];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function readComposePsOutput() {
  return execFileSync(process.env.DOCKER_BIN ?? "docker", ["compose", "ps", "--format", "json"], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
}

async function main() {
  const requiredServices = readRequiredServices();
  const timeoutMs = readPositiveIntegerEnv("COMPOSE_HEALTH_TIMEOUT_MS", 90_000);
  const pollIntervalMs = readPositiveIntegerEnv("COMPOSE_HEALTH_POLL_INTERVAL_MS", 2_000);
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const result = evaluateComposeRuntimeHealth(
      parseComposePsOutput(readComposePsOutput()),
      requiredServices,
    );

    if (result.ok) {
      return;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Compose services are not healthy yet: ${formatPendingComposeServices(result.pendingServices)}`,
      );
    }

    await sleep(Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 1)));
  }
}

main().catch((error) => {
  console.error("Compose healthcheck failed:", error);
  process.exitCode = 1;
});
