export interface ComposeServiceStatus {
  health: string | null;
  service: string;
  state: string;
}

export interface ComposeRuntimeHealthResult {
  ok: boolean;
  pendingServices: ComposeServiceStatus[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseComposeServiceStatus(value: unknown): ComposeServiceStatus {
  if (!isRecord(value) || typeof value.Service !== "string") {
    throw new Error("docker compose ps output is missing the Service field.");
  }

  return {
    service: value.Service,
    state: typeof value.State === "string" ? value.State : "unknown",
    health: typeof value.Health === "string" && value.Health.length > 0 ? value.Health : null,
  };
}

export function parseComposePsOutput(rawOutput: string): ComposeServiceStatus[] {
  const trimmedOutput = rawOutput.trim();

  if (!trimmedOutput) {
    return [];
  }

  if (trimmedOutput.startsWith("[")) {
    const parsedOutput = JSON.parse(trimmedOutput) as unknown;

    if (!Array.isArray(parsedOutput)) {
      throw new Error("docker compose ps JSON output must be an array.");
    }

    return parsedOutput.map((entry) => parseComposeServiceStatus(entry));
  }

  return trimmedOutput
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => parseComposeServiceStatus(JSON.parse(line) as unknown));
}

export function evaluateComposeRuntimeHealth(
  services: ComposeServiceStatus[],
  requiredServices: string[],
): ComposeRuntimeHealthResult {
  const servicesByName = new Map(services.map((service) => [service.service, service]));
  const pendingServices: ComposeServiceStatus[] = [];

  for (const serviceName of requiredServices) {
    const status = servicesByName.get(serviceName);

    if (!status) {
      pendingServices.push({
        service: serviceName,
        state: "missing",
        health: null,
      });
      continue;
    }

    const isRunning = status.state === "running";
    const isHealthy = status.health === "healthy";

    if (!isRunning || !isHealthy) {
      pendingServices.push(status);
    }
  }

  return {
    ok: pendingServices.length === 0,
    pendingServices,
  };
}

export function formatPendingComposeServices(pendingServices: ComposeServiceStatus[]): string {
  return pendingServices
    .map((service) =>
      service.health === null
        ? `${service.service}=${service.state}`
        : `${service.service}=${service.state}/${service.health}`,
    )
    .join(", ");
}
