import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.ADMIN_API_BASE_URL;
});

describe("admin runtime ready route", () => {
  it("returns a 200 ok JSON payload when the admin API upstream is ready", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://admin-api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns a 503 JSON payload when the admin API upstream returns a non-2xx response", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("upstream error", {
        status: 500,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://admin-api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });

  it("returns a 503 JSON payload when the admin API upstream is unreachable", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example";
    const fetchMock = vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/ready/route");
    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith("https://admin-api.example/v1/ready", {
      cache: "no-store",
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
