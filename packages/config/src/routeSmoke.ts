export interface RouteSmokeTarget {
  expectedStatus: number;
  name: string;
  requiredText?: string[];
  url: string;
}

interface RouteSmokeOptions {
  delayMs?: number;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  totalTimeoutMs?: number;
}

export interface RouteSmokeRuntimeOptions {
  delayMs: number;
  totalTimeoutMs: number;
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

function readPositiveInteger(rawValue: string | undefined, fallbackValue: number) {
  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function buildTotalTimeoutError(target: RouteSmokeTarget, totalTimeoutMs: number, lastError: unknown) {
  const detail =
    lastError === undefined ? "total timeout elapsed before the next retry" : describeError(lastError);

  return new Error(`${target.name} exceeded total timeout of ${totalTimeoutMs}ms: ${detail}`);
}

function resolveMaxAttempts(maxAttempts: number | undefined, totalTimeoutMs: number | undefined) {
  if (maxAttempts === undefined) {
    return totalTimeoutMs === undefined ? 10 : Number.POSITIVE_INFINITY;
  }

  if (maxAttempts === Number.POSITIVE_INFINITY) {
    return maxAttempts;
  }

  if (Number.isInteger(maxAttempts) && maxAttempts > 0) {
    return maxAttempts;
  }

  throw new Error("maxAttempts must be a positive integer or Infinity");
}

export function resolveRouteSmokeRuntimeOptions(
  env: Record<string, string | undefined>,
): RouteSmokeRuntimeOptions {
  return {
    totalTimeoutMs: readPositiveInteger(env.ROUTE_SMOKE_TIMEOUT_MS, 10_000),
    delayMs: readPositiveInteger(env.ROUTE_SMOKE_POLL_INTERVAL_MS, 1_000),
  };
}

export async function checkRouteTarget(
  target: RouteSmokeTarget,
  fetchImpl: typeof fetch = fetch,
  timeoutMs?: number,
) {
  const response = await fetchImpl(target.url, {
    cache: "no-store",
    signal: timeoutMs === undefined ? undefined : AbortSignal.timeout(Math.max(1, timeoutMs)),
  });

  if (response.status !== target.expectedStatus) {
    throw new Error(`${target.name} expected ${target.expectedStatus}, got ${response.status}`);
  }

  if (!target.requiredText || target.requiredText.length === 0) {
    return;
  }

  const responseBody = await response.text();
  const missingText = target.requiredText.filter((fragment) => !responseBody.includes(fragment));

  if (missingText.length > 0) {
    throw new Error(`${target.name} missing expected text: ${missingText.join(", ")}`);
  }
}

export async function runRouteSmoke(
  targets: RouteSmokeTarget[],
  options: RouteSmokeOptions = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const totalTimeoutMs = options.totalTimeoutMs;
  const maxAttempts = resolveMaxAttempts(options.maxAttempts, totalTimeoutMs);
  const delayMs = options.delayMs ?? 1_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const deadlineMs = totalTimeoutMs === undefined ? undefined : now() + totalTimeoutMs;

  for (const target of targets) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const remainingAttemptMs = deadlineMs === undefined ? undefined : deadlineMs - now();

      if (remainingAttemptMs !== undefined && remainingAttemptMs <= 0) {
        throw buildTotalTimeoutError(target, totalTimeoutMs!, lastError);
      }

      try {
        await checkRouteTarget(target, fetchImpl, remainingAttemptMs);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts) {
          throw new Error(
            `${target.name} failed after ${maxAttempts} attempts: ${describeError(lastError)}`,
          );
        }

        if (deadlineMs !== undefined) {
          const remainingSleepMs = deadlineMs - now();

          if (remainingSleepMs <= 0) {
            throw buildTotalTimeoutError(target, totalTimeoutMs!, lastError);
          }

          await sleep(Math.min(delayMs, remainingSleepMs));
          continue;
        }

        await sleep(delayMs);
      }
    }
  }
}
