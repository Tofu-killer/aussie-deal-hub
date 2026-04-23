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

const quickLinkCopy = {
  en: {
    navLabel: "Account quick links",
    home: "Home",
    favorites: "My Favorites",
    emailPreferences: "Email preferences",
    recentViews: "Recently viewed",
    login: "Login",
  },
  zh: {
    navLabel: "账户快捷导航",
    home: "首页",
    favorites: "我的收藏",
    emailPreferences: "邮件偏好",
    recentViews: "最近浏览",
    login: "登录",
  },
} as const;

function expectQuickLinks(locale: "en" | "zh") {
  const copy = quickLinkCopy[locale];
  const basePath = `/${locale}`;
  const navigation = screen.getByRole("navigation", { name: copy.navLabel });

  expect(within(navigation).getByRole("link", { name: copy.home }).getAttribute("href")).toBe(
    `${basePath}?sessionToken=${SESSION_TOKEN}`,
  );
  expect(
    within(navigation).getByRole("link", { name: copy.favorites }).getAttribute("href"),
  ).toBe(`${basePath}/favorites?sessionToken=${SESSION_TOKEN}`);
  expect(
    within(navigation)
      .getByRole("link", { name: copy.emailPreferences })
      .getAttribute("href"),
  ).toBe(`${basePath}/email-preferences?sessionToken=${SESSION_TOKEN}`);
  expect(
    within(navigation).getByRole("link", { name: copy.recentViews }).getAttribute("href"),
  ).toBe(`${basePath}/recent-views?sessionToken=${SESSION_TOKEN}`);
  expect(within(navigation).getByRole("link", { name: copy.login }).getAttribute("href")).toBe(
    `${basePath}/login?sessionToken=${SESSION_TOKEN}`,
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("account quick links", () => {
  it.each(["en", "zh"] as const)(
    "renders account quick links on the home page in %s",
    async (locale) => {
      render(
        await LocaleHomePage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ sessionToken: SESSION_TOKEN }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the favorites page in %s",
    async (locale) => {
      stubFavoritesFetch();

      render(
        await FavoritesPage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ sessionToken: SESSION_TOKEN }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the email preferences page in %s",
    async (locale) => {
      stubEmailPreferencesFetch();

      render(
        await EmailPreferencesPage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ sessionToken: SESSION_TOKEN }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the recent views page in %s",
    async (locale) => {
      stubRecentViewsCookie();

      render(
        await RecentViewsPage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ sessionToken: SESSION_TOKEN }),
        }),
      );

      expectQuickLinks(locale);
    },
  );

  it.each(["en", "zh"] as const)(
    "renders account quick links on the login page in %s",
    async (locale) => {
      render(
        await LoginPage({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({ sessionToken: SESSION_TOKEN }),
        }),
      );

      expectQuickLinks(locale);
    },
  );
});
