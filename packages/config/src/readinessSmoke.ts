export interface ReadinessTarget {
  expectedStatus: number;
  expectedOk?: boolean;
  name: string;
  url: string;
}

interface ReadinessSmokeOptions {
  delayMs?: number;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function describeReadinessDependencies(payload: Record<string, unknown>) {
  const dependencies = payload.dependencies;

  if (typeof dependencies !== "object" || dependencies === null) {
    return undefined;
  }

  const entries = Object.entries(dependencies).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return undefined;
  }

  return entries
    .map(([dependencyName, status]) => `${dependencyName}=${String(status)}`)
    .join(", ");
}

export async function checkReadinessTarget(
  target: ReadinessTarget,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(target.url, {
    cache: "no-store",
  });

  if (response.status !== target.expectedStatus) {
    throw new Error(`${target.name} expected ${target.expectedStatus}, got ${response.status}`);
  }

  if (target.expectedOk === undefined) {
    return;
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`${target.name} did not return a valid JSON readiness payload: ${describeError(error)}`);
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("ok" in payload) ||
    (payload as { ok?: unknown }).ok !== target.expectedOk
  ) {
    const actualOk =
      typeof payload === "object" && payload !== null && "ok" in payload
        ? String((payload as { ok?: unknown }).ok)
        : "missing";
    const dependenciesSummary =
      typeof payload === "object" && payload !== null
        ? describeReadinessDependencies(payload as Record<string, unknown>)
        : undefined;

    throw new Error(
      `${target.name} expected readiness payload ok=${target.expectedOk}, got ok=${actualOk}${
        dependenciesSummary ? ` with dependencies: ${dependenciesSummary}` : ""
      }`,
    );
  }
}

export async function runReadinessSmoke(
  targets: ReadinessTarget[],
  options: ReadinessSmokeOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = options.maxAttempts ?? 10;
  const delayMs = options.delayMs ?? 1000;
  const sleep = options.sleep ?? defaultSleep;

  for (const target of targets) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await checkReadinessTarget(target, fetchImpl);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw new Error(
            `${target.name} failed after ${maxAttempts} attempts: ${describeError(lastError)}`,
          );
        }

        await sleep(delayMs);
      }
    }
  }
}
