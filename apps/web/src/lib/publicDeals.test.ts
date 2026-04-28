import { describe, expect, it } from "vitest";

import { normalizeLivePublicDeal } from "./publicDeals";

describe("normalizeLivePublicDeal", () => {
  it("keeps source-language live copy intact and builds Chinese fallback copy for English payloads", () => {
    const deal = normalizeLivePublicDeal(
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
      "zh",
    );

    expect(deal.locales.en).toEqual({
      title: "Breville Barista Express for A$499",
      summary: "Live catalog deal loaded from the public API.",
    });
    expect(deal.locales.zh.title).not.toBe("Breville Barista Express for A$499");
    expect(deal.locales.zh.title).toContain("优惠");
    expect(deal.locales.zh.title).toContain("Breville Barista Express for A$499");
    expect(deal.locales.zh.summary).not.toBe("Live catalog deal loaded from the public API.");
    expect(deal.locales.zh.summary).toContain("原始摘要");
    expect(deal.locales.zh.summary).toContain("Live catalog deal loaded from the public API.");
  });

  it("keeps source-language live copy intact and builds English fallback copy for Chinese payloads", () => {
    const deal = normalizeLivePublicDeal(
      {
        locale: "zh",
        slug: "dyson-airwrap-a-699",
        title: "Dyson Airwrap 现价 A$699",
        summary: "直播促销价格已接入公开优惠接口。",
        category: "Deals",
        merchant: "Dyson AU",
        currentPrice: "699.00",
        affiliateUrl: "https://www.dyson.com.au/deal",
        publishedAt: "2026-04-23T01:00:00.000Z",
      },
      "en",
    );

    expect(deal.locales.zh).toEqual({
      title: "Dyson Airwrap 现价 A$699",
      summary: "直播促销价格已接入公开优惠接口。",
    });
    expect(deal.locales.en.title).not.toBe("Dyson Airwrap 现价 A$699");
    expect(deal.locales.en.title).toContain("deal");
    expect(deal.locales.en.title).toContain("Dyson Airwrap 现价 A$699");
    expect(deal.locales.en.summary).not.toBe("直播促销价格已接入公开优惠接口。");
    expect(deal.locales.en.summary).toContain("Original summary");
    expect(deal.locales.en.summary).toContain("直播促销价格已接入公开优惠接口。");
  });

  it("localizes unknown-merchant placeholders in fallback copy and detail text", () => {
    const deal = normalizeLivePublicDeal(
      {
        locale: "en",
        slug: "breville-barista-express-for-a-499",
        title: "Breville Barista Express for A$499",
        summary: "Live catalog deal loaded from the public API.",
        category: "Deals",
        currentPrice: "499.00",
        affiliateUrl: "https://www.thegoodguys.com.au/deal",
        publishedAt: "2026-04-23T01:00:00.000Z",
      },
      "zh",
    );

    expect(deal.merchant).toEqual({
      id: "unknown-merchant",
      name: "未知商家",
    });
    expect(deal.locales.zh.title).toContain("未知商家");
    expect(deal.locales.zh.title).not.toContain("Unknown merchant");
    expect(deal.locales.zh.summary).toContain("商家是 未知商家");
    expect(deal.detail.locales.zh.whyWorthIt).toContain("商家是 未知商家");
    expect(deal.detail.locales.en.whyWorthIt).toContain("Unknown merchant");
  });
});
