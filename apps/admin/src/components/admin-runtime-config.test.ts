import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.ADMIN_API_BASE_URL;
});

describe("admin runtime config", () => {
  it("proxies GET /v1 requests to the admin API origin at runtime", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example/";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("../app/v1/[...path]/route");
    const response = await GET(new Request("http://admin.example/v1/admin/leads?limit=10"), {
      params: Promise.resolve({ path: ["admin", "leads"] }),
    });

    expect(fetchMock).toHaveBeenCalledWith("https://admin-api.example/v1/admin/leads?limit=10", {
      method: "GET",
      headers: {},
      body: undefined,
      cache: "no-store",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [] });
  });

  it("proxies POST bodies to the admin API origin at runtime", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("../app/v1/[...path]/route");
    const response = await POST(
      new Request("http://admin.example/v1/admin/leads", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sourceId: "src_amazon" }),
      }),
      {
        params: Promise.resolve({ path: ["admin", "leads"] }),
      },
    );

    expect(fetchMock).toHaveBeenCalledWith("https://admin-api.example/v1/admin/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ sourceId: "src_amazon" }),
      cache: "no-store",
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns JSON 503 when the admin API origin is unreachable", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const { GET } = await import("../app/v1/[...path]/route");
    const response = await GET(new Request("http://admin.example/v1/admin/leads"), {
      params: Promise.resolve({ path: ["admin", "leads"] }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "Admin API unavailable.",
    });
  });

  it("returns JSON 503 when ADMIN_API_BASE_URL is missing", async () => {
    delete process.env.ADMIN_API_BASE_URL;

    const { GET } = await import("../app/v1/[...path]/route");
    const response = await GET(new Request("http://admin.example/v1/admin/leads"), {
      params: Promise.resolve({ path: ["admin", "leads"] }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "ADMIN_API_BASE_URL is required for admin runtime API requests.",
    });
  });
});
