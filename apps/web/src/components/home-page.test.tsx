// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LocaleHomePage from "../app/[locale]/page";
import { getHomeSectionsFromDefinitions } from "../lib/publicDeals";

afterEach(() => {
  cleanup();
});

describe("home page curated sections", () => {
  it("renders curated sections in English", async () => {
    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Featured deals" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Historical lows" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Freebies" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Gift card offers" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Latest deals" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Trending merchants" })).toBeTruthy();

    const featuredSection = screen.getByRole("region", { name: "Featured deals" });
    expect(
      within(featuredSection).getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeTruthy();

    const latestDealsSection = screen.getByRole("region", { name: "Latest deals" });
    const latestDealLinks = within(latestDealsSection).getAllByRole("link");
    expect(latestDealLinks).toHaveLength(4);
    expect(latestDealLinks[0]?.textContent).toBe("Nintendo Switch OLED for A$399 at Amazon AU");
    expect(within(latestDealsSection).getByText("Amazon AU")).toBeTruthy();

    const trendingMerchantsSection = screen.getByRole("region", { name: "Trending merchants" });
    const trendingMerchantItems = within(trendingMerchantsSection).getAllByRole("listitem");
    expect(trendingMerchantItems[0]?.textContent).toBe("Amazon AU");
    expect(trendingMerchantItems[1]?.textContent).toBe("Costco AU");

    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en");
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe("/zh");
    expect(screen.getByRole("link", { name: "Open Favorites" }).getAttribute("href")).toBe(
      "/en/favorites",
    );
  });

  it("renders curated sections in Chinese", async () => {
    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "zh" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "精选优惠" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "历史低价" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "免费领取" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "礼品卡优惠" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "最新优惠" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "热门商家" })).toBeTruthy();
  });

  it("preserves session token across locale switch and favorites entry", async () => {
    const { container } = render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_456" }),
      }),
    );

    const sessionTokenInput = container.querySelector(
      'input[type="hidden"][name="sessionToken"]',
    ) as HTMLInputElement | null;
    expect(sessionTokenInput?.value).toBe("session_test_456");

    const featuredSection = screen.getByRole("region", { name: "Featured deals" });
    expect(
      within(featuredSection)
        .getByRole("link", {
          name: "Nintendo Switch OLED for A$399 at Amazon AU",
        })
        .getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au?sessionToken=session_test_456");

    const latestDealsSection = screen.getByRole("region", { name: "Latest deals" });
    expect(
      within(latestDealsSection)
        .getByRole("link", {
          name: "Nintendo Switch OLED for A$399 at Amazon AU",
        })
        .getAttribute("href"),
    ).toBe("/en/deals/nintendo-switch-oled-amazon-au?sessionToken=session_test_456");

    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe(
      "/en?sessionToken=session_test_456",
    );
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe(
      "/zh?sessionToken=session_test_456",
    );
    expect(screen.getByRole("link", { name: "Open Favorites" }).getAttribute("href")).toBe(
      "/en/favorites?sessionToken=session_test_456",
    );
  });

  it("throws when a curated section references a missing deal slug", () => {
    expect(() =>
      getHomeSectionsFromDefinitions("en", [
        {
          id: "featured",
          locales: {
            en: "Featured deals",
            zh: "精选优惠",
          },
          slugs: ["missing-deal-slug"],
        },
      ]),
    ).toThrowError('Missing public deal slug "missing-deal-slug" in home section "featured"');
  });
});
