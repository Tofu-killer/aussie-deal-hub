// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { cookieSetMock, cookiesMock } = vi.hoisted(() => ({
  cookieSetMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import LoginPage from "../app/[locale]/login/page";
import {
  buildLoginRequestCodeRedirectTarget,
  buildLoginVerifyErrorRedirectTarget,
  buildLoginVerifySuccessRedirectTarget,
  submitRequestCodeFromForm,
  submitVerifyCodeFromForm,
} from "../lib/auth";
import { verifyLoginCode } from "../lib/serverApi";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  cookieSetMock.mockReset();
  cookiesMock.mockReset();
  cookiesMock.mockResolvedValue({
    get() {
      return undefined;
    },
    set: cookieSetMock,
  });
});

describe("login page", () => {
  it("renders English copy and success feedback", async () => {
    render(
      await LoginPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          status: "request_success",
          email: "user@example.com",
          sessionToken: "session_existing_123",
        }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Login" })).toBeTruthy();
    expect(screen.getAllByLabelText("Email address")).toHaveLength(2);
    expect(screen.getByLabelText("Verification code")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send code" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Verify code" })).toBeTruthy();
    expect(screen.getByText("Verification code sent.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe(
      "/en",
    );
  });

  it("renders Chinese copy", async () => {
    render(
      await LoginPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("heading", { name: "登录" })).toBeTruthy();
    expect(screen.getAllByLabelText("邮箱地址")).toHaveLength(2);
    expect(screen.getByLabelText("验证码")).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送验证码" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "验证并登录" })).toBeTruthy();
  });

  it("requests a verification code with normalized email", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3001/v1/auth/request-code");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "content-type": "application/json",
      });
      expect(init?.body).toBe(
        JSON.stringify({
          email: "user@example.com",
        }),
      );

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const formData = new FormData();
    formData.set("email", "  user@example.com  ");

    await expect(
      submitRequestCodeFromForm({
        activeLocale: "en",
        formData,
      }),
    ).resolves.toEqual({
      status: "success",
      message: "Verification code sent.",
      email: "user@example.com",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("verifies code and returns session token", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3001/v1/auth/verify-code");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "content-type": "application/json",
      });
      expect(init?.body).toBe(
        JSON.stringify({
          email: "user@example.com",
          code: "123456",
        }),
      );

      return new Response(
        JSON.stringify({
          sessionToken: "session_new_123",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    });

    vi.stubGlobal("fetch", fetchMock);
    cookiesMock.mockResolvedValue({
      get() {
        return undefined;
      },
      set: cookieSetMock,
    });

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("code", "123456");

    await expect(
      submitVerifyCodeFromForm({
        activeLocale: "en",
        formData,
      }),
    ).resolves.toEqual({
      status: "success",
      message: "Logged in successfully.",
      sessionToken: "session_new_123",
      email: "user@example.com",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cookieSetMock).toHaveBeenCalledWith(
      "aussie_deal_hub_session",
      "session_new_123",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      }),
    );
  });

  it("returns localized error feedback when verification fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("invalid", { status: 401 });
      }),
    );

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("code", "000000");

    await expect(
      submitVerifyCodeFromForm({
        activeLocale: "zh",
        formData,
      }),
    ).resolves.toEqual({
      status: "error",
      message: "验证码错误或已过期。",
      email: "user@example.com",
    });
  });

  it("builds request-code redirect target with status and email", () => {
    expect(
      buildLoginRequestCodeRedirectTarget({
        activeLocale: "en",
        sessionToken: "session_existing_123",
        status: "success",
        email: "user@example.com",
      }),
    ).toBe("/en/login?status=request_success&email=user%40example.com");

    expect(
      buildLoginRequestCodeRedirectTarget({
        activeLocale: "zh",
        status: "error",
        email: "foo@bar.com",
      }),
    ).toBe("/zh/login?status=request_error&email=foo%40bar.com");
  });

  it("builds verify-error redirect target", () => {
    expect(
      buildLoginVerifyErrorRedirectTarget({
        activeLocale: "en",
        sessionToken: "session_existing_123",
        email: "user@example.com",
      }),
    ).toBe("/en/login?status=verify_error&email=user%40example.com");
  });

  it("builds verify-success redirect target to favorites with session token", () => {
    expect(
      buildLoginVerifySuccessRedirectTarget({
        activeLocale: "en",
        sessionToken: "session_new_123",
      }),
    ).toBe("/en/favorites");
  });

  it("throws when verify-code response misses session token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }),
    );

    await expect(verifyLoginCode("user@example.com", "123456")).rejects.toThrow(
      "Missing session token.",
    );
  });

  it("maps missing verify session token to localized error result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      }),
    );

    const formData = new FormData();
    formData.set("email", "user@example.com");
    formData.set("code", "123456");

    await expect(
      submitVerifyCodeFromForm({
        activeLocale: "en",
        formData,
      }),
    ).resolves.toEqual({
      status: "error",
      message: "Invalid or expired verification code.",
      email: "user@example.com",
    });
  });
});
