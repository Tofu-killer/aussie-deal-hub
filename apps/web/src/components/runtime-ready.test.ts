import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.API_BASE_URL;
});

describe("web runtime ready route", () => {
  it("returns a 200 ok JSON payload when the API upstream is ready", async () => {
    process.env.API_BASE_URL = "https://api.example/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("preserves the upstream readiness payload when the API reports an unhealthy dependency", async () => {
    process.env.API_BASE_URL = "https://api.example";
    const unhealthyPayload = {
      ok: false,
      dependencies: {
        redis: "unavailable",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(unhealthyPayload), {
        status: 503,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(unhealthyPayload);
  });

  it("normalizes an unhealthy readiness payload even when the upstream responds with 200", async () => {
    process.env.API_BASE_URL = "https://api.example";
    const unhealthyPayload = {
      ok: false,
      dependencies: {
        dbPublishingSchema: "unavailable",
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(unhealthyPayload), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(unhealthyPayload);
  });

  it("returns a 503 JSON payload when the API upstream is unreachable", async () => {
    process.env.API_BASE_URL = "https://api.example";
    const fetchMock = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
