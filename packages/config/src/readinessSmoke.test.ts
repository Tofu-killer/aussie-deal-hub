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
      .mockImplementation(async () =>
        new Response(
          JSON.stringify({
            ok: false,
            dependencies: {
              dbPublishingSchema: "unavailable",
              redis: "unavailable",
            },
          }),
          { status: 200 },
        ),
      );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runReadinessSmoke(targets, {
        fetchImpl: fetchMock,
        sleep,
        maxAttempts: 2,
        delayMs: 10,
      }),
    ).rejects.toThrow(
      "api-ready failed after 2 attempts: api-ready expected readiness payload ok=true, got ok=false with dependencies: dbPublishingSchema=unavailable, redis=unavailable",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("fails with the raw unexpected ok value when the payload shape is otherwise valid", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ ok: "yes" }), { status: 200 }));

    await expect(
      runReadinessSmoke(targets, {
        fetchImpl: fetchMock,
        maxAttempts: 1,
      }),
    ).rejects.toThrow(
      "api-ready failed after 1 attempts: api-ready expected readiness payload ok=true, got ok=yes",
    );
  });

  it("fails when the readiness payload is healthy but misses a required JSON subset", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          status: "starting",
        }),
        { status: 200 },
      ),
    );

    await expect(
      runReadinessSmoke(
        [
          {
            ...targets[0],
            name: "worker-runtime-ready",
            url: "http://127.0.0.1:3001/v1/admin/runtime/worker",
            requiredJson: {
              status: "ok",
            },
          },
        ],
        {
          fetchImpl: fetchMock,
          maxAttempts: 1,
        },
      ),
    ).rejects.toThrow(
      'worker-runtime-ready failed after 1 attempts: worker-runtime-ready missing expected readiness JSON at $.status: expected "ok", got "starting"',
    );
  });
});
