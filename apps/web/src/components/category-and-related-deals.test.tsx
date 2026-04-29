// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CategoryPage from "../app/[locale]/categories/[category]/page";
import DealDetailPage from "../app/[locale]/deals/[slug]/page";
import * as discovery from "../lib/discovery";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe("category listing and related deals", () => {
  it("renders category listing with bilingual title and clean locale switch links", async () => {
    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "deals" }),
        searchParams: Promise.resolve({ sessionToken: "session_test_123" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Deals", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Available deals", level: 2 })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "English" }).getAttribute("href"),
    ).toBe("/en/categories/deals");
    expect(screen.getByRole("link", { name: "中文" }).getAttribute("href")).toBe("/zh/categories/deals");
    expect(
      screen.getByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }).getAttribute("href"),
    ).toBe("https://www.amazon.com.au/deal");
    expect(screen.getByRole("link", { name: "Read breakdown" }).getAttribute("href")).toBe(
      "/en/deals/nintendo-switch-oled-amazon-au",
    );
  });

  it("renders empty state copy in Chinese when category has no deals", async () => {
    vi.spyOn(discovery, "getCategoryDealGroups").mockReturnValue([
      {
        category: "freebies",
        label: "免费领取",
        deals: [],
      },
    ]);

    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "zh", category: "freebies" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "免费领取优惠" })).toBeTruthy();
    expect(screen.getByText("该分类暂无优惠。")).toBeTruthy();
  });

  it("throws notFound for invalid category", async () => {
    await expect(
      CategoryPage({
        params: Promise.resolve({ locale: "en", category: "featured" }),
      }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
  });

  it("renders related deals section on deal detail page", async () => {
    render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
      }),
    );

    const relatedSection = screen.getByRole("region", { name: "Related deals" });
    expect(
      within(relatedSection).getByRole("link", {
        name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
      }),
    ).toBeTruthy();
    expect(
      within(relatedSection).queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
  });

  it("keeps related deal detail links clean on detail page", async () => {
    render(
      await DealDetailPage({
        params: Promise.resolve({
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
        }),
        searchParams: Promise.resolve({ sessionToken: "session_test_789" }),
      }),
    );

    const relatedSection = screen.getByRole("region", { name: "Related deals" });
    expect(
      within(relatedSection)
        .getByRole("link", {
          name: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
        })
        .getAttribute("href"),
    ).toBe("https://www.costco.com.au/deal");
    expect(within(relatedSection).getAllByRole("link", { name: "Read breakdown" })[0]?.getAttribute("href")).toBe(
      "/en/deals/airpods-pro-2-costco-au",
    );
  });

  it("merges live API deals into category listings", async () => {
    stubLiveDealsResponse();

    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "deals" }),
      }),
    );

    expect(
      screen.getByRole("link", {
        name: "Breville Barista Express for A$499",
      }).getAttribute("href"),
    ).toBe("https://www.thegoodguys.com.au/deal");
  });

  it("does not mix seeded discovery deals into live-backed category listings", async () => {
    stubLiveDealsResponse();

    render(
      await CategoryPage({
        params: Promise.resolve({ locale: "en", category: "deals" }),
      }),
    );

    const availableDealsSection = screen.getByRole("region", { name: "Available deals" });
    expect(
      within(availableDealsSection).queryByRole("link", {
        name: "Nintendo Switch OLED for A$399 at Amazon AU",
      }),
    ).toBeNull();
  });

  it("renders localized fallback copy for english-only live deals in Chinese category listings", async () => {
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
      await CategoryPage({
        params: Promise.resolve({ locale: "zh", category: "deals" }),
      }),
    );

    const fallbackDealLink = screen.getByRole("link", {
      name: "The Good Guys 当前优惠：Breville Barista Express for A$499",
    });
    const fallbackDealCard = fallbackDealLink.closest("article");

    expect(fallbackDealLink.getAttribute("href")).toBe("https://www.thegoodguys.com.au/deal");
    expect(fallbackDealCard).toBeTruthy();
    expect(
      screen.getByText(
        "当前标价 A$499.00，商家是 The Good Guys。商家原文：Live catalog deal loaded from the public API.",
      ),
    ).toBeTruthy();
    expect(
      within(fallbackDealCard as HTMLElement).getByRole("link", { name: "站内详情" }).getAttribute(
        "href",
      ),
    ).toBe("/zh/deals/breville-barista-express-for-a-499");
  });
});
