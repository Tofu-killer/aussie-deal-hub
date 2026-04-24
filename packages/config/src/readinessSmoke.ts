export interface ReadinessTarget {
  expectedStatus: number;
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
