import { Router } from "express";

export interface HealthPayload {
  ok: boolean;
  dependencies?: Record<string, string>;
  error?: string;
}

export type HealthChecker = () => Promise<HealthPayload> | HealthPayload;
export type HealthDependencyProbe = () => Promise<unknown> | unknown;

export function healthPayload(): HealthPayload {
  return {
    ok: true,
  };
}

function describeDependencyFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out")
  ) {
    return "timeout";
  }

  if (
    normalizedMessage.includes("authentication") ||
    normalizedMessage.includes("auth failed") ||
    normalizedMessage.includes("access denied") ||
    normalizedMessage.includes("password")
  ) {
    return "authentication_failed";
  }

  if (
    normalizedMessage.includes("econnrefused") ||
    normalizedMessage.includes("enotfound") ||
    normalizedMessage.includes("econnreset") ||
    normalizedMessage.includes("connect") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("can't reach database server") ||
    normalizedMessage.includes("cannot reach database server")
  ) {
    return "connection_failed";
  }

  if (
    normalizedMessage.includes("relation") ||
    normalizedMessage.includes("column") ||
    normalizedMessage.includes("table") ||
    normalizedMessage.includes("schema") ||
    normalizedMessage.includes("does not exist") ||
    normalizedMessage.includes("missing")
  ) {
    return "schema_mismatch";
  }

  return "unavailable";
}

export function createDependencyHealthChecker(
  probes: Record<string, HealthDependencyProbe>,
): HealthChecker {
  const probeEntries = Object.entries(probes);

  if (probeEntries.length === 0) {
    return healthPayload;
  }

  return async () => {
    const dependencies: Record<string, string> = {};

    await Promise.all(
      probeEntries.map(async ([dependencyName, probe]) => {
        try {
          await probe();
        } catch (error) {
          dependencies[dependencyName] = describeDependencyFailure(error);
        }
      }),
    );

    return Object.keys(dependencies).length === 0
      ? healthPayload()
      : {
          ok: false,
          dependencies,
        };
  };
}

export function createHealthRouter(checkHealth?: HealthChecker) {
  const router = Router();
  const healthChecker = checkHealth ?? healthPayload;

  router.get("/", async (_request, response) => {
    try {
      const payload = await healthChecker();
      response.status(payload.ok ? 200 : 503).json(payload);
    } catch {
      response.status(503).json({ ok: false, error: "health_check_failed" });
    }
  });

  return router;
}
