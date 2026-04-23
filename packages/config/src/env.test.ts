import { describe, expect, it } from "vitest";
import { parseApiEnv } from "./env";

describe("parseApiEnv", () => {
  it("parses required server env, applies defaults, and normalizes ports", () => {
    const env = parseApiEnv({
      NODE_ENV: "development",
      API_PORT: "3100",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      REDIS_URL: "redis://127.0.0.1:6379",
      SESSION_SECRET: "development-secret",
      EMAIL_FROM: "deals@example.com",
    });

    expect(env.API_PORT).toBe(3100);
    expect(env.API_HOST).toBe("127.0.0.1");
    expect(env.NODE_ENV).toBe("development");
  });
});
