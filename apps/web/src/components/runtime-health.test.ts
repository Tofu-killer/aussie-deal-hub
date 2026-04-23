import { describe, expect, it } from "vitest";

describe("web runtime health route", () => {
  it("returns a 200 ok JSON payload", async () => {
    const { GET } = await import("../app/health/route");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
