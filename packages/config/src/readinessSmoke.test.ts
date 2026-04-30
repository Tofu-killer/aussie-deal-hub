import { describe, expect, it, vi } from "vitest";

import { runReadinessSmoke, type ReadinessTarget } from "./readinessSmoke";

const targets: ReadinessTarget[] = [
  {
    name: "api-ready",
    url: "http://127.0.0.1:3001/v1/ready",
    expectedStatus: 200,
    expectedOk: true,
  },
];

describe("readiness smoke", () => {
  it("retries a target until it becomes ready", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runReadinessSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        maxAttempts: 2,
        delayMs: 10,
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("fails after the last retry with the final error", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runReadinessSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        maxAttempts: 3,
        delayMs: 10,
      }),
    ).rejects.toThrow("api-ready failed after 3 attempts");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("treats a 200 response with an unhealthy readiness payload as a failed attempt", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false }), { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runReadinessSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        maxAttempts: 2,
        delayMs: 10,
      }),
    ).rejects.toThrow("api-ready failed after 2 attempts");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
