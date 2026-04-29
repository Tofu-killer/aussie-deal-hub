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
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function stubLiveDealsResponse(routeLocale = "en") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      if (String(input) === `http://127.0.0.1:3001/v1/public/deals/${routeLocale}`) {
        return new Response(
          JSON.stringify({
            items: [
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

describe("home hero search and search results page", () => {
  it("renders a GET hero search form on home without propagating session token", async () => {
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
    expect(form?.querySelector('input[name="sessionToken"]')).toBeNull();
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

    expect(searchDeals).toHaveBeenCalledWith("switch", "en", undefined, expect.any(Array));
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(screen.getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au",
    );
  });

  it("renders localized empty state when query is blank", async () => {
    render(
      await SearchPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({ q: "   " }),
      }),
    );

    expect(screen.getAllByText("请输入关键词开始搜索。").length).toBeGreaterThan(0);
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

  it("keeps back-to-home link clean", async () => {
    vi.mocked(searchDeals).mockReturnValueOnce([]);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "switch", sessionToken: "session_test_999" }),
      }),
    );

    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/en");
  });

  it("searches merged live API deals", async () => {
    stubLiveDealsResponse();
    vi.mocked(searchDeals).mockReturnValueOnce([
      {
        slug: "breville-barista-express-for-a-499",
        categories: ["deals"],
        currentPrice: "A$499",
        originalPrice: "A$499",
        discountLabel: "Live deal",
        dealUrl: "https://www.thegoodguys.com.au/deal",
        detail: expect.any(Object),
        merchant: {
          id: "the-good-guys",
          name: "The Good Guys",
        },
        publishedAt: "2026-04-23T01:00:00.000Z",
        locales: {
          en: {
            title: "Breville Barista Express for A$499",
            summary: "Live catalog deal loaded from the public API.",
          },
          zh: {
            title: "Breville Barista Express for A$499",
            summary: "Live catalog deal loaded from the public API.",
          },
        },
      },
    ]);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "breville" }),
      }),
    );

    expect(searchDeals).toHaveBeenCalledWith("breville", "en", undefined, expect.any(Array));
    expect(
      screen.getByRole("link", {
        name: "Breville Barista Express for A$499",
      }).getAttribute("href"),
    ).toBe("https://www.thegoodguys.com.au/deal");
  });

  it("renders localized fallback copy on Chinese search results for English-only live deals", async () => {
    stubLiveDealsResponse("zh");
    const actualDiscovery = await vi.importActual<typeof import("../lib/discovery")>(
      "../lib/discovery",
    );
    vi.mocked(searchDeals).mockImplementationOnce(actualDiscovery.searchDeals);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "zh" }),
        searchParams: Promise.resolve({ q: "breville" }),
      }),
    );

    expect(searchDeals).toHaveBeenCalledWith("breville", "zh", undefined, expect.any(Array));
    expect(
      screen.getByRole("link", {
        name: "The Good Guys 当前优惠：Breville Barista Express for A$499",
      }).getAttribute("href"),
    ).toBe("https://www.thegoodguys.com.au/deal");
    expect(
      screen.getByText(
        "当前标价 A$499.00，商家是 The Good Guys。商家原文：Live catalog deal loaded from the public API.",
      ),
    ).toBeTruthy();
  });

  it("renders merged live API deals for price token queries", async () => {
    stubLiveDealsResponse();
    const actualDiscovery = await vi.importActual<typeof import("../lib/discovery")>(
      "../lib/discovery",
    );
    vi.mocked(searchDeals).mockImplementationOnce(actualDiscovery.searchDeals);

    render(
      await SearchPage({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({ q: "499.00" }),
      }),
    );

    expect(searchDeals).toHaveBeenCalledWith("499.00", "en", undefined, expect.any(Array));
    expect(
      screen.getByRole("link", {
        name: "Breville Barista Express for A$499",
      }).getAttribute("href"),
    ).toBe("https://www.thegoodguys.com.au/deal");
  });
});
