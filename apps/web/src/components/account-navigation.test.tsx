// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import LocaleHomePage from "../app/[locale]/page";
import FavoritesPage from "../app/[locale]/favorites/page";
import EmailPreferencesPage from "../app/[locale]/email-preferences/page";
import RecentViewsPage from "../app/[locale]/recent-views/page";
import LoginPage from "../app/[locale]/login/page";

const SESSION_TOKEN = "session_nav_123";
const SESSION_COOKIE_NAME = "aussie_deal_hub_session";

const quickLinkCopy = {
  en: {
    navLabel: "Account quick links",
    home: "Home",
    favorites: "My Favorites",
    emailPreferences: "Email preferences",
    recentViews: "Recently viewed",
    logout: "Logout",
  },
  zh: {
    navLabel: "账户快捷导航",
    home: "首页",
    favorites: "我的收藏",
    emailPreferences: "邮件偏好",
    recentViews: "最近浏览",
    logout: "退出登录",
  },
} as const;

function expectQuickLinks(locale: "en" | "zh") {
  const copy = quickLinkCopy[locale];
  const basePath = `/${locale}`;
  const navigation = screen.getByRole("navigation", { name: copy.navLabel });

  expect(within(navigation).getByRole("link", { name: copy.home }).getAttribute("href")).toBe(
    `${basePath}`,
  );
  expect(
    within(navigation).getByRole("link", { name: copy.favorites }).getAttribute("href"),
  ).toBe(`${basePath}/favorites`);
  expect(
    within(navigation)
      .getByRole("link", { name: copy.emailPreferences })
      .getAttribute("href"),
  ).toBe(`${basePath}/email-preferences`);
  expect(
    within(navigation).getByRole("link", { name: copy.recentViews }).getAttribute("href"),
  ).toBe(`${basePath}/recent-views`);
  expect(within(navigation).getByRole("link", { name: copy.logout }).getAttribute("href")).toBe(
    `${basePath}/logout`,
  );
}

function stubFavoritesFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("http://127.0.0.1:3001/v1/favorites");

      return new Response(
        JSON.stringify({
          items: [],
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
}

function stubEmailPreferencesFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("http://127.0.0.1:3001/v1/digest-preferences");

      return new Response(
        JSON.stringify({
          locale: "en",
          frequency: "daily",
          categories: [],
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
}

function stubRecentViewsCookie() {
  vi.mocked(cookies).mockResolvedValue({
    get() {
      return undefined;
    },
  } as Awaited<ReturnType<typeof cookies>>);
}

function stubSessionCookie(sessionToken = SESSION_TOKEN) {
  vi.mocked(cookies).mockResolvedValue({
    get(name: string) {
      if (name === SESSION_COOKIE_NAME) {
        return {
          name,
          value: sessionToken,
        };
      }

      return undefined;
    },
  } as Awaited<ReturnType<typeof cookies>>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("account quick links", () => {
  it.each(["en", "zh"] as const)(
    "renders account quick links on the home page in %s",
    async (locale) => {
      stubSessionCookie();

      render(
        await LocaleHomePage({
          params: Promise.resolve({ locale }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the favorites page in %s",
    async (locale) => {
      stubSessionCookie();
      stubFavoritesFetch();

      render(
        await FavoritesPage({
          params: Promise.resolve({ locale }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the email preferences page in %s",
    async (locale) => {
      stubSessionCookie();
      stubEmailPreferencesFetch();

      render(
        await EmailPreferencesPage({
          params: Promise.resolve({ locale }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the recent views page in %s",
    async (locale) => {
      stubSessionCookie();

      render(
        await RecentViewsPage({
          params: Promise.resolve({ locale }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the login page in %s",
    async (locale) => {
      stubSessionCookie();

      render(
        await LoginPage({
          params: Promise.resolve({ locale }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it("does not treat a sessionToken query param as an authenticated session", async () => {
    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: SESSION_TOKEN }),
      }),
    );

    const navigation = screen.getByRole("navigation", { name: quickLinkCopy.en.navLabel });
    expect(within(navigation).getByRole("link", { name: "Login" }).getAttribute("href")).toBe(
      "/en/login",
    );
    expect(within(navigation).queryByRole("link", { name: "Logout" })).toBeNull();
  });

  it("uses session cookie for favorites API calls while keeping links clean", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get(name: string) {
        if (name === "aussie_deal_hub_session") {
          return {
            name,
            value: SESSION_TOKEN,
          };
        }

        return undefined;
      },
    } as Awaited<ReturnType<typeof cookies>>);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("http://127.0.0.1:3001/v1/favorites");
        expect(init?.headers).toMatchObject({
          "x-session-token": SESSION_TOKEN,
        });

        return new Response(
          JSON.stringify({
            items: [],
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
      await FavoritesPage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    const navigation = screen.getByRole("navigation", { name: quickLinkCopy.en.navLabel });
    expect(within(navigation).getByRole("link", { name: quickLinkCopy.en.home }).getAttribute("href")).toBe(
      "/en",
    );
    expect(within(navigation).getByRole("link", { name: quickLinkCopy.en.favorites }).getAttribute("href")).toBe(
      "/en/favorites",
    );
  });
});
