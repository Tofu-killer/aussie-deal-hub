// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LocaleHomePage from "../app/[locale]/page";
import { getHomeSectionsFromDefinitions } from "../lib/publicDeals";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubLiveDealsResponse(
  itemsByLocale: Partial<
    Record<
      "en" | "zh",
      Array<{
        affiliateUrl: string;
        category: string;
        currentPrice: string;
        locale: string;
        merchant: string;
        publishedAt: string;
        slug: string;
        summary: string;
        title: string;
      }>
    >
  > = {
    en: [
      {
        locale: "en",
        slug: "breville-barista-express-for-a-499",
        title: "Breville Barista Express for A$499",
        summary: "Live catalog deal loaded from the public API.",
        category: "Deals",
        merchant: "The Good Guys",
        currentPrice: "499.00",
        affiliateUrl: "https://www.thegoodguys.com.au/deal",
        publishedAt: "2026-04-23T01:00:00.000Z",
      },
    ],
    zh: [],
  },
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
        return new Response(
          JSON.stringify({
            items: itemsByLocale.en ?? [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/zh") {
        return new Response(
          JSON.stringify({
            items: itemsByLocale.zh ?? [],
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unexpected fetch for ${String(input)}`);
    }) as typeof fetch,
  );
}

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
    expect(
      within(featuredSection)
        .getByRole("link", {
          name: "Nintendo Switch OLED for A$399 at Amazon AU",
        })
        .getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(within(featuredSection).getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au",
    );

    const latestDealsSection = screen.getByRole("region", { name: "Latest deals" });
    const latestDealTitles = within(latestDealsSection).getAllByRole("heading", { level: 3 });
    expect(latestDealTitles).toHaveLength(4);
    expect(latestDealTitles[0]?.textContent).toBe("Nintendo Switch OLED for A$399 at Amazon AU");
    expect(within(latestDealsSection).getByText("Amazon AU")).toBeTruthy();

    const trendingMerchantsSection = screen.getByRole("region", { name: "Trending merchants" });
    const trendingMerchantLinks = within(trendingMerchantsSection).getAllByRole("link");
    expect(trendingMerchantLinks[0]?.getAttribute("href")).toBe(
      "/en/search?q=Amazon+AU&merchant=amazon-au",
    );
    expect(trendingMerchantLinks[0]?.textContent).toContain("Amazon AU");
    expect(trendingMerchantLinks[1]?.getAttribute("href")).toBe(
      "/en/search?q=Costco+AU&merchant=costco-au",
    );
    expect(trendingMerchantLinks[1]?.textContent).toContain("Costco AU");

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
        searchParams: Promise.resolve({ sessionToken: "session_zh_123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "精选优惠" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "历史低价" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "免费领取" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "礼品卡优惠" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "最新优惠" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "热门商家" })).toBeTruthy();

    const trendingMerchantsSection = screen.getByRole("region", { name: "热门商家" });
    const amazonLink = within(trendingMerchantsSection).getByRole("link", { name: "Amazon AU" });
    expect(amazonLink.getAttribute("href")).toBe("/zh/search?q=Amazon+AU&merchant=amazon-au");
    const merchantMetaId = amazonLink.getAttribute("aria-describedby");
    expect(merchantMetaId).toBeTruthy();
    const merchantMeta = merchantMetaId ? document.getElementById(merchantMetaId) : null;
    expect(merchantMeta?.textContent).toContain("1 条优惠");
    expect(merchantMeta?.textContent).toContain("最近 2026-04-22");
  });

  it("renders localized fallback copy for english-only live deals on the Chinese home page", async () => {
    stubLiveDealsResponse({
      en: [
        {
          locale: "en",
          slug: "breville-barista-express-for-a-499",
          title: "Breville Barista Express for A$499",
          summary: "Live catalog deal loaded from the public API.",
          category: "Deals",
          merchant: "The Good Guys",
          currentPrice: "499.00",
          affiliateUrl: "https://www.thegoodguys.com.au/deal",
          publishedAt: "2026-04-23T01:00:00.000Z",
        },
      ],
      zh: [],
    });

    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "zh" }),
      }),
    );

    const latestDealsSection = screen.getByRole("region", { name: "最新优惠" });
    const fallbackDealLink = within(latestDealsSection).getByRole("link", {
      name: "The Good Guys 当前优惠：Breville Barista Express for A$499",
    });
    const fallbackDealCard = fallbackDealLink.closest("article");

    expect(fallbackDealLink.getAttribute("href")).toBe("https://www.thegoodguys.com.au/deal");
    expect(fallbackDealCard).toBeTruthy();
    expect(
      within(latestDealsSection).getByText(
        "当前标价 A$499.00，商家是 The Good Guys。商家原文：Live catalog deal loaded from the public API.",
      ),
    ).toBeTruthy();
    expect(
      within(fallbackDealCard as HTMLElement).getByRole("link", { name: "站内详情" }).getAttribute(
        "href",
      ),
    ).toBe("/zh/deals/breville-barista-express-for-a-499");
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
    expect(sessionTokenInput).toBeNull();

    const featuredSection = screen.getByRole("region", { name: "Featured deals" });
    expect(
      within(featuredSection)
        .getByRole("link", {
          name: "Nintendo Switch OLED for A$399 at Amazon AU",
        })
        .getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(within(featuredSection).getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au",
    );

    const latestDealsSection = screen.getByRole("region", { name: "Latest deals" });
    expect(
      within(latestDealsSection)
        .getByRole("link", {
          name: "Nintendo Switch OLED for A$399 at Amazon AU",
        })
        .getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(within(latestDealsSection).getAllByRole("link", { name: "Read breakdown" })[0]?.getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au",
    );

    expect(screen.getByRole("link", { name: "English" }).getAttribute("href")).toBe("/en");
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe("/zh");
    expect(screen.getByRole("link", { name: "Open Favorites" }).getAttribute("href")).toBe(
      "/en/favorites",
    );

    const trendingMerchantsSection = screen.getByRole("region", { name: "Trending merchants" });
    expect(
      within(trendingMerchantsSection)
        .getByRole("link", { name: "Amazon AU" })
        .getAttribute("href"),
    ).toBe("/en/search?q=Amazon+AU&merchant=amazon-au");
  });

  it("merges live API deals into latest deals and trending merchants", async () => {
    stubLiveDealsResponse({
      en: [
        {
          locale: "en",
          slug: "breville-barista-express-for-a-499",
          title: "Breville Barista Express for A$499",
          summary: "Live catalog deal loaded from the public API.",
          category: "Deals",
          merchant: "The Good Guys",
          currentPrice: "499.00",
          affiliateUrl: "https://www.thegoodguys.com.au/deal",
          publishedAt: "2026-04-23T01:00:00.000Z",
        },
        {
          locale: "en",
          slug: "breville-smart-grinder-pro-for-a-279",
          title: "Breville Smart Grinder Pro for A$279",
          summary: "Pair it with the espresso machine while the price holds.",
          category: "Deals",
          merchant: "The Good Guys",
          currentPrice: "279.00",
          affiliateUrl: "https://www.thegoodguys.com.au/grinder-deal",
          publishedAt: "2026-04-22T05:00:00.000Z",
        },
        {
          locale: "en",
          slug: "audible-30-day-trial-now-a-0",
          title: "Audible 30-day trial now A$0",
          summary: "Live free trial with one included audiobook credit.",
          category: "Freebies",
          merchant: "Audible AU",
          currentPrice: "0",
          affiliateUrl: "https://www.audible.com.au/deal",
          publishedAt: "2026-04-24T05:00:00.000Z",
        },
      ],
      zh: [],
    });

    render(
      await LocaleHomePage({
        params: Promise.resolve({ locale: "en" }),
      }),
    );

    const featuredSection = screen.getByRole("region", { name: "Featured deals" });
    expect(
      within(featuredSection)
        .getByRole("link", { name: "Breville Barista Express for A$499" })
        .getAttribute("href"),
    ).toBe("https://www.thegoodguys.com.au/deal");
    expect(
      within(featuredSection).getByRole("link", { name: "Read breakdown" }).getAttribute("href"),
    ).toBe("/en/deals/breville-barista-express-for-a-499");

    const freebiesSection = screen.getByRole("region", { name: "Freebies" });
    expect(
      within(freebiesSection)
        .getByRole("link", { name: "Audible 30-day trial now A$0" })
        .getAttribute("href"),
    ).toBe("https://www.audible.com.au/deal");
    expect(
      within(freebiesSection).getByRole("link", { name: "Read breakdown" }).getAttribute("href"),
    ).toBe("/en/deals/audible-30-day-trial-now-a-0");

    const historicalLowsSection = screen.getByRole("region", { name: "Historical lows" });
    expect(
      within(historicalLowsSection)
        .getByRole("link", {
          name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
        })
        .getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");

    const latestDealsSection = screen.getByRole("region", { name: "Latest deals" });
    expect(
      within(latestDealsSection)
        .getByRole("link", { name: "Breville Barista Express for A$499" })
        .getAttribute("href"),
    ).toBe(
      "https://www.thegoodguys.com.au/deal",
    );
    expect(within(latestDealsSection).getAllByText("The Good Guys")).toHaveLength(2);
    expect(within(latestDealsSection).getByText("Audible AU")).toBeTruthy();

    const trendingMerchantsSection = screen.getByRole("region", { name: "Trending merchants" });
    const goodGuysLink = within(trendingMerchantsSection).getByRole("link", { name: "The Good Guys" });
    expect(goodGuysLink.getAttribute("href")).toBe("/en/search?q=The+Good+Guys&merchant=the-good-guys");
    const goodGuysItem = goodGuysLink.closest("li");
    expect(goodGuysItem).toBeTruthy();
    expect(within(goodGuysItem as HTMLLIElement).getByText("2 deals")).toBeTruthy();
    expect(within(goodGuysItem as HTMLLIElement).getByText("Latest 2026-04-23")).toBeTruthy();
    expect(within(trendingMerchantsSection).getByText("Audible AU")).toBeTruthy();
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
