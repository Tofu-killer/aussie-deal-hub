import { Router } from "express";

export interface HealthPayload {
  ok: boolean;
  dependencies?: Record<string, string>;
}

export type HealthChecker = () => Promise<HealthPayload> | HealthPayload;
export type HealthDependencyProbe = () => Promise<unknown> | unknown;

export function healthPayload(): HealthPayload {
  return {
    ok: true,
  };
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
        } catch {
          dependencies[dependencyName] = "unavailable";
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
      response.status(503).json({ ok: false });
    }
  });

  return router;
}
