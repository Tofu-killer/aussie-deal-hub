import { describe, expect, it } from "vitest";

import { getSeededPublicDeals, normalizeLivePublicDeal } from "./publicDeals";

describe("normalizeLivePublicDeal", () => {
  it.each([
    ["Historical lows", "历史低价", "historical-lows"],
    ["Freebies", "免费领取", "freebies"],
    ["Gift card offers", "礼品卡优惠", "gift-card-offers"],
  ] as const)(
    "uses category-aware fallback titles for %s live deals",
    (sourceCategory, chinesePrefix, expectedCategory) => {
      const deal = normalizeLivePublicDeal(
        {
          locale: "en",
          slug: `live-${expectedCategory}`,
          title: "Sample live title",
          summary: "Sample live summary",
          category: sourceCategory,
          merchant: "The Good Guys",
          currentPrice: "499.00",
          affiliateUrl: "https://www.thegoodguys.com.au/deal",
          publishedAt: "2026-04-23T01:00:00.000Z",
        },
        "zh",
      );

      expect(deal.categories).toEqual([expectedCategory]);
      expect(deal.locales.zh.title).toBe(`The Good Guys ${chinesePrefix}：Sample live title`);
    },
  );

  it.each([
    ["历史低价", "tracked low"],
    ["免费领取", "freebie"],
    ["礼品卡优惠", "gift card offer"],
  ] as const)(
    "uses category-aware English fallback titles for %s live deals",
    (sourceCategory, englishPrefix) => {
      const deal = normalizeLivePublicDeal(
        {
          locale: "zh",
          slug: `live-${englishPrefix.replace(/\s+/g, "-")}`,
          title: "示例直播标题",
          summary: "示例直播摘要",
          category: sourceCategory,
          merchant: "Dyson AU",
          currentPrice: "699.00",
          affiliateUrl: "https://www.dyson.com.au/deal",
          publishedAt: "2026-04-23T01:00:00.000Z",
        },
        "en",
      );

      expect(deal.locales.en.title).toBe(`Dyson AU ${englishPrefix}: 示例直播标题`);
    },
  );

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
    expect(deal.locales.zh.title).toContain("当前优惠");
    expect(deal.locales.zh.title).toContain("Breville Barista Express for A$499");
    expect(deal.locales.zh.summary).not.toBe("Live catalog deal loaded from the public API.");
    expect(deal.locales.zh.summary).toContain("当前标价 A$499.00，商家是 The Good Guys。");
    expect(deal.locales.zh.summary).toContain("商家原文：");
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
    expect(deal.locales.en.title).toContain("current deal");
    expect(deal.locales.en.title).toContain("Dyson Airwrap 现价 A$699");
    expect(deal.locales.en.summary).not.toBe("直播促销价格已接入公开优惠接口。");
    expect(deal.locales.en.summary).toContain("Current listed price is A$699.00 at Dyson AU.");
    expect(deal.locales.en.summary).toContain("Merchant copy:");
    expect(deal.locales.en.summary).toContain("直播促销价格已接入公开优惠接口。");
  });

  it("omits merchant-copy labels when the source summary is blank", () => {
    const deal = normalizeLivePublicDeal(
      {
        locale: "en",
        slug: "blank-summary-live-deal",
        title: "Dyson Airwrap for A$699",
        summary: "   ",
        category: "Deals",
        merchant: "Dyson AU",
        currentPrice: "699.00",
        affiliateUrl: "https://www.dyson.com.au/deal",
        publishedAt: "2026-04-23T01:00:00.000Z",
      },
      "zh",
    );

    expect(deal.locales.zh.summary).toBe("当前标价 A$699.00，商家是 Dyson AU。");
    expect(deal.locales.en.summary).toBe("   ");
  });

  it("uses the base English fallback summary when a Chinese live summary is blank", () => {
    const deal = normalizeLivePublicDeal(
      {
        locale: "zh",
        slug: "blank-zh-summary-live-deal",
        title: "Dyson Airwrap 现价 A$699",
        summary: "   ",
        category: "Deals",
        merchant: "Dyson AU",
        currentPrice: "699.00",
        affiliateUrl: "https://www.dyson.com.au/deal",
        publishedAt: "2026-04-23T01:00:00.000Z",
      },
      "en",
    );

    expect(deal.locales.en.summary).toBe("Current listed price is A$699.00 at Dyson AU.");
    expect(deal.locales.zh.summary).toBe("   ");
  });

  it("trims cross-locale merchant copy before composing the fallback summary", () => {
    const deal = normalizeLivePublicDeal(
      {
        locale: "zh",
        slug: "trimmed-summary-live-deal",
        title: "Dyson Airwrap 现价 A$699",
        summary: "  直播促销价格已接入公开优惠接口。  ",
        category: "Deals",
        merchant: "Dyson AU",
        currentPrice: "699.00",
        affiliateUrl: "https://www.dyson.com.au/deal",
        publishedAt: "2026-04-23T01:00:00.000Z",
      },
      "en",
    );

    expect(deal.locales.en.summary).toBe(
      "Current listed price is A$699.00 at Dyson AU. Merchant copy: 直播促销价格已接入公开优惠接口。",
    );
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

  it("keeps seeded fallback copy free of internal implementation wording", () => {
    const userVisibleCopy = getSeededPublicDeals()
      .flatMap((deal) => [
        deal.locales.en.title,
        deal.locales.en.summary,
        deal.locales.zh.title,
        deal.locales.zh.summary,
        deal.detail.locales.en.validity,
        deal.detail.locales.en.whyWorthIt,
        ...deal.detail.locales.en.highlights,
        ...deal.detail.locales.en.howToGetIt,
        ...deal.detail.locales.en.termsAndWarnings,
        deal.detail.locales.zh.validity,
        deal.detail.locales.zh.whyWorthIt,
        ...deal.detail.locales.zh.highlights,
        ...deal.detail.locales.zh.howToGetIt,
        ...deal.detail.locales.zh.termsAndWarnings,
      ])
      .join(" ");

    expect(userVisibleCopy).not.toMatch(/seeded/i);
  });
});
