import { describe, expect, it, vi } from "vitest";

import {
  resolveRouteSmokeRuntimeOptions,
  runRouteSmoke,
  type RouteSmokeTarget,
} from "./routeSmoke";

const targets: RouteSmokeTarget[] = [
  {
    name: "web-home-en",
    url: "http://127.0.0.1:3000/en",
    expectedStatus: 200,
    requiredText: ["Latest deals", "Trending merchants"],
  },
];

const apiTarget: RouteSmokeTarget = {
  name: "api-public-deal-en",
  url: "http://127.0.0.1:3001/v1/public/deals/en/nintendo-switch-oled-amazon-au",
  expectedStatus: 200,
  requiredJson: {
    locale: "en",
    slug: "nintendo-switch-oled-amazon-au",
    title: "Nintendo Switch OLED for A$399 at Amazon AU",
  },
};

describe("route smoke", () => {
  it("parses the route smoke runtime options from environment variables", () => {
    expect(
      resolveRouteSmokeRuntimeOptions({
        ROUTE_SMOKE_TIMEOUT_MS: "2500",
        ROUTE_SMOKE_POLL_INTERVAL_MS: "250",
      }),
    ).toEqual({
      totalTimeoutMs: 2_500,
      delayMs: 250,
    });

    expect(
      resolveRouteSmokeRuntimeOptions({
        ROUTE_SMOKE_TIMEOUT_MS: "0",
        ROUTE_SMOKE_POLL_INTERVAL_MS: "not-a-number",
      }),
    ).toEqual({
      totalTimeoutMs: 10_000,
      delayMs: 1_000,
    });
  });

  it("retries a target until the expected page content appears", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("<html><body>Loading</body></html>", { status: 200 }))
      .mockResolvedValueOnce(
        new Response("<html><body><h2>Latest deals</h2><h2>Trending merchants</h2></body></html>", {
          status: 200,
        }),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRouteSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        maxAttempts: 2,
        delayMs: 10,
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("fails after the last retry when expected content never appears", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("<html><body>Placeholder shell</body></html>", { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runRouteSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        maxAttempts: 3,
        delayMs: 10,
      }),
    ).rejects.toThrow("web-home-en failed after 3 attempts");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("fails immediately on an unexpected status", async () => {
    await expect(
      runRouteSmoke(targets, {
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status: 503 })),
        maxAttempts: 1,
        delayMs: 10,
      }),
    ).rejects.toThrow("web-home-en expected 200, got 503");
  });

  it("accepts route targets that require a partial JSON contract", async () => {
    await expect(
      runRouteSmoke([apiTarget], {
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({
              locale: "en",
              slug: "nintendo-switch-oled-amazon-au",
              title: "Nintendo Switch OLED for A$399 at Amazon AU",
              merchant: "Amazon AU",
              priceContext: {
                snapshots: [],
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
        ),
        maxAttempts: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it("fails when a JSON route returns 200 without the required contract", async () => {
    await expect(
      runRouteSmoke([apiTarget], {
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({
              locale: "en",
              slug: "nintendo-switch-oled-amazon-au",
              title: "Placeholder",
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
        ),
        maxAttempts: 1,
      }),
    ).rejects.toThrow(
      'api-public-deal-en failed after 1 attempts: api-public-deal-en missing expected JSON at $.title: expected "Nintendo Switch OLED for A$399 at Amazon AU", got "Placeholder"',
    );
  });

  it("treats the timeout budget as a whole-smoke deadline instead of a per-target allowance", async () => {
    const nowState = {
      value: 0,
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("warming up", { status: 503 }))
      .mockResolvedValueOnce(
        new Response("<html><body><h2>Latest deals</h2><h2>Trending merchants</h2></body></html>", {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("warming up", { status: 503 }));
    const sleep = vi.fn(async (delayMs: number) => {
      nowState.value += delayMs;
    });

    await expect(
      runRouteSmoke(
        [
          targets[0],
          {
            name: "web-search-en",
            url: "http://127.0.0.1:3000/en/search?q=switch",
            expectedStatus: 200,
            requiredText: ["Search results"],
          },
        ],
        {
          fetchImpl: fetchMock,
          sleep,
          delayMs: 10,
          totalTimeoutMs: 15,
          now: () => nowState.value,
        },
      ),
    ).rejects.toThrow("web-search-en exceeded total timeout of 15ms");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10);
    expect(sleep).toHaveBeenNthCalledWith(2, 5);
  });

  it("still fails once max attempts are exhausted under a total timeout budget", async () => {
    const nowState = {
      value: 0,
    };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("warming up", { status: 503 }));
    const sleep = vi.fn(async (delayMs: number) => {
      nowState.value += delayMs;
    });

    await expect(
      runRouteSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        delayMs: 10,
        maxAttempts: 2,
        totalTimeoutMs: 100,
        now: () => nowState.value,
      }),
    ).rejects.toThrow("web-home-en failed after 2 attempts");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight request when the remaining request budget elapses", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new Error("request aborted"));
          });
        }),
    );

    await expect(
      runRouteSmoke(targets, {
        fetchImpl: fetchMock,
        totalTimeoutMs: 5,
      }),
    ).rejects.toThrow("web-home-en exceeded total timeout of 5ms");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects invalid maxAttempts values instead of silently skipping all checks", async () => {
    const fetchMock = vi.fn<typeof fetch>();

    await expect(
      runRouteSmoke(targets, {
        fetchImpl: fetchMock,
        maxAttempts: 0,
      }),
    ).rejects.toThrow("maxAttempts must be a positive integer or Infinity");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
