// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/discovery", () => ({
  searchDeals: vi.fn(),
}));

import LocaleHomePage from "../app/[locale]/page";
import SearchPage from "../app/[locale]/search/page";
import { searchDeals } from "../lib/discovery";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("home hero search and search results page", () => {
  it("renders a GET hero search form on home and preserves session token", async () => {
    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_789" }),
      }),
    );

    const queryInput = screen.getByRole("textbox", { name: "Search deals" });
    const form = queryInput.closest("form");

    expect(form).toBeTruthy();
    expect(form?.getAttribute("method")).toBe("get");
    expect(form?.getAttribute("action")).toBe("/en/search");
    expect(form?.querySelector('input[name="q"]')).toBeTruthy();
    expect(form?.querySelector('input[name="sessionToken"]')?.getAttribute("value")).toBe(
      "session_test_789",
    );
  });

  it("renders search results and passes locale/query to discovery search", async () => {
    vi.mocked(searchDeals).mockReturnValueOnce([
      {
        slug: "nintendo-switch-oled-amazon-au",
        categories: ["deals", "historical-lows"],
        currentPrice: "A$399",
        originalPrice: "A$469",
        discountLabel: "15% off",
        dealUrl: "https://www.amazon.com.au/deal",
        locales: {
          en: {
            title: "Nintendo Switch OLED for A$399 at Amazon AU",
            summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
          },
          zh: {
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
            summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
          },
        },
      },
    ]);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "switch", sessionToken: "session_test_789" }),
      }),
    );

    expect(searchDeals).toHaveBeenCalledWith("switch", "en");
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au?sessionToken=session_test_789");
  });

  it("renders localized empty state when query is blank", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({ q: "   " }),
      }),
    );

    expect(screen.getByText("请输入关键词开始搜索。")).toBeTruthy();
  });

  it("renders localized empty state when no result is found", async () => {
    vi.mocked(searchDeals).mockReturnValueOnce([]);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "nohit" }),
      }),
    );

    expect(screen.getByText('No deals found for "nohit".')).toBeTruthy();
  });

  it("keeps session token on back-to-home link", async () => {
    vi.mocked(searchDeals).mockReturnValueOnce([]);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "switch", sessionToken: "session_test_999" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe(
      "/en?sessionToken=session_test_999",
    );
  });
});
