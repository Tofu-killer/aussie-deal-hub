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
  items: Array<{
    affiliateUrl: string;
    category: string;
    currentPrice: string;
    locale: string;
    merchant: string;
    publishedAt: string;
    slug: string;
    summary: string;
    title: string;
  }> = [
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
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      if (String(input) === "http://127.0.0.1:3001/v1/public/deals/en") {
        return new Response(
          JSON.stringify({
            items,
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
    ).toBe("https://www.amazon.com.au/deal");
    expect(within(featuredSection).getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au?sessionToken=session_test_456",
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
      "/en/deals/nintendo-switch-oled-amazon-au?sessionToken=session_test_456",
    );

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

  it("merges live API deals into latest deals and trending merchants", async () => {
    stubLiveDealsResponse([
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
        slug: "audible-30-day-trial-now-a-0",
        title: "Audible 30-day trial now A$0",
        summary: "Live free trial with one included audiobook credit.",
        category: "Freebies",
        merchant: "Audible AU",
        currentPrice: "0",
        affiliateUrl: "https://www.audible.com.au/deal",
        publishedAt: "2026-04-24T05:00:00.000Z",
      },
    ]);

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
    expect(within(latestDealsSection).getByText("The Good Guys")).toBeTruthy();
    expect(within(latestDealsSection).getByText("Audible AU")).toBeTruthy();

    const trendingMerchantsSection = screen.getByRole("region", { name: "Trending merchants" });
    expect(within(trendingMerchantsSection).getByText("The Good Guys")).toBeTruthy();
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
