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

export async function checkRouteTarget(
  target: RouteSmokeTarget,
  fetchImpl: typeof fetch = fetch,
) {
  const response = await fetchImpl(target.url, {
    cache: "no-store",
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
  const maxAttempts = options.maxAttempts ?? 10;
  const delayMs = options.delayMs ?? 1_000;
  const sleep = options.sleep ?? defaultSleep;

  for (const target of targets) {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await checkRouteTarget(target, fetchImpl);
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
