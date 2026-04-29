import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SESSION_COOKIE_NAME } from "./lib/session";
import { middleware } from "./middleware";

const SESSION_TOKEN = "session_test_123";

function createRequest(url: string) {
  return new NextRequest(url);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("web session token middleware", () => {
  it("stores the session token in a cookie and redirects to a clean url", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://deals.example");

    const response = middleware(
      createRequest(`https://deals.example/en/search?merchant=amazon&q=switch&sessionToken=${SESSION_TOKEN}`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://deals.example/en/search?merchant=amazon&q=switch",
    );

    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=${SESSION_TOKEN}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Secure");
  });

  it("removes a lone session token query param without leaving a trailing question mark", () => {
    const response = middleware(
      createRequest(`http://local.test/zh/favorites?sessionToken=${SESSION_TOKEN}`),
    );

    expect(response.headers.get("location")).toBe("http://local.test/zh/favorites");
  });

  it("passes through requests that do not carry a session token", () => {
    const response = middleware(createRequest("http://local.test/en/favorites?merchant=amazon"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
