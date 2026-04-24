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
    expect(env.AUTH_CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(env.SMTP_SECURE).toBe(false);
  });

  it("requires smtp delivery settings in production", () => {
    expect(() =>
      parseApiEnv({
        NODE_ENV: "production",
        API_PORT: "3100",
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
        REDIS_URL: "redis://127.0.0.1:6379",
        SESSION_SECRET: "development-secret",
        EMAIL_FROM: "deals@example.com",
      }),
    ).toThrow(/SMTP_HOST/);
  });

  it("parses smtp delivery configuration and auth code ttl overrides", () => {
    const env = parseApiEnv({
      NODE_ENV: "production",
      API_PORT: "3100",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub",
      REDIS_URL: "redis://127.0.0.1:6379",
      SESSION_SECRET: "development-secret",
      EMAIL_FROM: "deals@example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      AUTH_CODE_TTL_MS: "300000",
    });

    expect(env.SMTP_HOST).toBe("smtp.example.com");
    expect(env.SMTP_PORT).toBe(587);
    expect(env.SMTP_SECURE).toBe(false);
    expect(env.SMTP_USER).toBe("mailer");
    expect(env.SMTP_PASS).toBe("secret");
    expect(env.AUTH_CODE_TTL_MS).toBe(300000);
  });
});
