import { describe, expect, it, vi } from "vitest";

import { runRouteSmoke, type RouteSmokeTarget } from "./routeSmoke";

const targets: RouteSmokeTarget[] = [
  {
    name: "web-home-en",
    url: "http://127.0.0.1:3000/en",
    expectedStatus: 200,
    requiredText: ["Latest deals", "Trending merchants"],
  },
];

describe("route smoke", () => {
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
});
