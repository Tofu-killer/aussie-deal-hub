import { afterEach, describe, expect, it } from "vitest";

import nextConfig from "../../next.config.mjs";

afterEach(() => {
  delete process.env.ADMIN_API_BASE_URL;
});

describe("admin runtime config", () => {
  it("rewrites browser /v1 requests through the admin Next server to the admin API origin", async () => {
    process.env.ADMIN_API_BASE_URL = "https://admin-api.example";

    const rewrites = await nextConfig.rewrites();

    expect(rewrites).toContainEqual({
      source: "/v1/:path*",
      destination: "https://admin-api.example/v1/:path*",
    });
  });
});
