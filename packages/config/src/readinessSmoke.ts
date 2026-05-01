export interface ReadinessTarget {
  expectedStatus: number;
  expectedOk?: boolean;
  name: string;
  requiredJson?: unknown;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeJsonValue(value: unknown) {
  return JSON.stringify(value);
}

function findMissingJsonSubset(actual: unknown, expected: unknown, path = "$"): string | null {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      return `${path}: expected array, got ${describeJsonValue(actual)}`;
    }

    for (const [index, expectedItem] of expected.entries()) {
      if (index >= actual.length) {
        return `${path}[${index}]: expected ${describeJsonValue(expectedItem)}, got undefined`;
      }

      const nestedMismatch = findMissingJsonSubset(actual[index], expectedItem, `${path}[${index}]`);

      if (nestedMismatch) {
        return nestedMismatch;
      }
    }

    return null;
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      return `${path}: expected object, got ${describeJsonValue(actual)}`;
    }

    for (const [key, expectedValue] of Object.entries(expected)) {
      if (!(key in actual)) {
        return `${path}.${key}: expected ${describeJsonValue(expectedValue)}, got undefined`;
      }

      const nestedMismatch = findMissingJsonSubset(actual[key], expectedValue, `${path}.${key}`);

      if (nestedMismatch) {
        return nestedMismatch;
      }
    }

    return null;
  }

  return Object.is(actual, expected)
    ? null
    : `${path}: expected ${describeJsonValue(expected)}, got ${describeJsonValue(actual)}`;
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

  if (target.requiredJson === undefined) {
    return;
  }

  const mismatch = findMissingJsonSubset(payload, target.requiredJson);

  if (mismatch) {
    const dependenciesSummary = describeReadinessDependencies(payload as Record<string, unknown>);

    throw new Error(
      `${target.name} missing expected readiness JSON at ${mismatch}${
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
