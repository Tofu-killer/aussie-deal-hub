// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import EmailPreferencesPage from "../app/[locale]/email-preferences/page";
import { submitDigestPreferencesFromForm } from "../lib/emailPreferences";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("email preferences page", () => {
  it("loads persisted digest preferences and renders bilingual copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("http://127.0.0.1:3001/v1/digest-preferences");
        expect(init?.headers).toMatchObject({
          "x-session-token": "session_test_123",
        });

        return new Response(
          JSON.stringify({
            locale: "zh",
            frequency: "weekly",
            categories: ["deals", "historical-lows"],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }),
    );

    render(
      await EmailPreferencesPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Email preferences" })).toBeTruthy();
    expect((screen.getByLabelText("Digest locale") as HTMLSelectElement).value).toBe("zh");
    expect((screen.getByLabelText("Digest frequency") as HTMLSelectElement).value).toBe(
      "weekly",
    );
    expect((screen.getByLabelText("Deals") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Historical lows") as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe(
      "/en?sessionToken=session_test_123",
    );
  });

  it("shows load error copy and does not show success copy when GET fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("upstream error", {
          status: 500,
        });
      }),
    );

    render(
      await EmailPreferencesPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({
          sessionToken: "session_test_123",
          status: "success",
        }),
      }),
    );

    expect(screen.getByText("Unable to load preferences.")).toBeTruthy();
    expect(screen.queryByText("Preferences updated.")).toBeNull();
  });

  it("submits deduplicated locale, frequency, and categories and returns success status", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://127.0.0.1:3001/v1/digest-preferences");
      expect(init?.method).toBe("PUT");
      expect(init?.headers).toMatchObject({
        "x-session-token": "session_test_123",
        "content-type": "application/json",
      });
      expect(init?.body).toBe(
        JSON.stringify({
          locale: "zh",
          frequency: "weekly",
          categories: ["deals", "historical-lows"],
        }),
      );

      return new Response(
        JSON.stringify({
          locale: "zh",
          frequency: "weekly",
          categories: ["deals", "historical-lows"],
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

    const formData = new FormData();
    formData.set("locale", "zh");
    formData.set("frequency", "weekly");
    formData.append("categories", "deals");
    formData.append("categories", "deals");
    formData.append("categories", "historical-lows");

    await expect(
      submitDigestPreferencesFromForm({
        activeLocale: "en",
        sessionToken: "session_test_123",
        formData,
      }),
    ).resolves.toEqual({
      status: "success",
      message: "Preferences updated.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats 204 update responses as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(null, {
          status: 204,
        });
      }),
    );

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("frequency", "daily");
    formData.append("categories", "deals");

    await expect(
      submitDigestPreferencesFromForm({
        activeLocale: "en",
        sessionToken: "session_test_123",
        formData,
      }),
    ).resolves.toEqual({
      status: "success",
      message: "Preferences updated.",
    });
  });

  it("returns localized error feedback when update fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("upstream error", {
          status: 500,
        });
      }),
    );

    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("frequency", "daily");
    formData.append("categories", "deals");

    await expect(
      submitDigestPreferencesFromForm({
        activeLocale: "zh",
        sessionToken: "session_test_123",
        formData,
      }),
    ).resolves.toEqual({
      status: "error",
      message: "保存偏好失败。",
    });
  });
});
