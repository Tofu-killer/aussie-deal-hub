import { afterEach, describe, expect, it } from "vitest";

import {
  buildAdminBasicAuthChallenge,
  decodeBasicAuthorizationHeader,
  getAdminBasicAuthConfig,
  hasValidAdminBasicAuth,
} from "../lib/access";

afterEach(() => {
  delete process.env.ADMIN_BASIC_AUTH_USERNAME;
  delete process.env.ADMIN_BASIC_AUTH_PASSWORD;
  delete process.env.ADMIN_BASIC_AUTH_REALM;
});

describe("admin basic auth helpers", () => {
  it("returns null when admin access protection is not configured", () => {
    expect(getAdminBasicAuthConfig()).toBeNull();
    expect(hasValidAdminBasicAuth(null)).toBe(true);
  });

  it("decodes valid basic authorization headers", () => {
    const headerValue = "Basic YWRtaW46c3VwZXItc2VjcmV0";

    expect(decodeBasicAuthorizationHeader(headerValue)).toEqual({
      username: "admin",
      password: "super-secret",
    });
  });

  it("validates credentials against the configured username and password", () => {
    process.env.ADMIN_BASIC_AUTH_USERNAME = "admin";
    process.env.ADMIN_BASIC_AUTH_PASSWORD = "super-secret";

    expect(hasValidAdminBasicAuth("Basic YWRtaW46c3VwZXItc2VjcmV0")).toBe(true);
    expect(hasValidAdminBasicAuth("Basic YWRtaW46d3Jvbmc=")).toBe(false);
    expect(hasValidAdminBasicAuth(null)).toBe(false);
  });

  it("builds the auth challenge using the configured realm", () => {
    process.env.ADMIN_BASIC_AUTH_USERNAME = "admin";
    process.env.ADMIN_BASIC_AUTH_PASSWORD = "super-secret";
    process.env.ADMIN_BASIC_AUTH_REALM = "Editorial Console";

    expect(buildAdminBasicAuthChallenge()).toBe(
      'Basic realm="Editorial Console", charset="UTF-8"',
    );
  });
});
