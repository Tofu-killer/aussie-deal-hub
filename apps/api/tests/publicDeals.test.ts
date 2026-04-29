import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("public deals", () => {
  it("lists seeded live published deals for a locale", async () => {
    const app = buildApp();
    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        expect.objectContaining({
          id: "seed-nintendo-switch-oled-amazon-au",
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
          category: "Deals",
          merchant: "Amazon AU",
          currentPrice: "399.00",
          affiliateUrl: "https://www.amazon.com.au/deal",
          publishedAt: "2025-04-15T00:00:00.000Z",
          locales: [
            {
              locale: "en",
              slug: "nintendo-switch-oled-amazon-au",
              title: "Nintendo Switch OLED for A$399 at Amazon AU",
              summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
            },
            {
              locale: "zh",
              slug: "nintendo-switch-oled-amazon-au",
              title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
              summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
            },
          ],
        }),
      ],
    });
  });

  it("lists injected live published deals when the store exposes listPublishedDeals", async () => {
    let listedLocale: string | null = null;
    const app = buildApp({
      publishedDealStore: {
        async listPublishedDeals(locale: string) {
          listedLocale = locale;

          return [
            {
              id: "deal_live_123",
              locale: "en",
              slug: "breville-barista-express-for-a-499",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the persisted public store.",
              category: "Kitchen",
              merchant: "The Good Guys",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
              locales: [
                {
                  locale: "en",
                  slug: "breville-barista-express-for-a-499",
                  title: "Breville Barista Express for A$499",
                  summary: "Live catalog deal loaded from the persisted public store.",
                },
                {
                  locale: "zh",
                  slug: "the-good-guys-咖啡机-a-499",
                  title: "The Good Guys 咖啡机 A$499",
                  summary: "持久化公开 store 返回的直播优惠。",
                },
              ],
            },
          ];
        },
        async getPublishedDeal() {
          throw new Error("list route should not call getPublishedDeal");
        },
        async hasPublishedDealSlug(slug: string) {
          return slug === "breville-barista-express-for-a-499";
        },
      },
    } as never);

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en",
    });

    expect(response.status).toBe(200);
    expect(listedLocale).toBe("en");
    expect(response.body).toEqual({
      items: [
        {
          id: "deal_live_123",
          locale: "en",
          slug: "breville-barista-express-for-a-499",
          title: "Breville Barista Express for A$499",
          summary: "Live catalog deal loaded from the persisted public store.",
          category: "Kitchen",
          merchant: "The Good Guys",
          currentPrice: "499.00",
          affiliateUrl: "https://www.thegoodguys.com.au/deal",
          publishedAt: "2026-04-23T01:00:00.000Z",
          locales: [
            {
              locale: "en",
              slug: "breville-barista-express-for-a-499",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the persisted public store.",
            },
            {
              locale: "zh",
              slug: "the-good-guys-咖啡机-a-499",
              title: "The Good Guys 咖啡机 A$499",
              summary: "持久化公开 store 返回的直播优惠。",
            },
          ],
        },
      ],
    });
  });

  it("returns a published localized deal by locale and slug", async () => {
    const app = buildApp();
    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en/nintendo-switch-oled-amazon-au"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: "seed-nintendo-switch-oled-amazon-au",
      locale: "en",
      slug: "nintendo-switch-oled-amazon-au",
      title: "Nintendo Switch OLED for A$399 at Amazon AU",
      locales: [
        {
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
        },
        {
          locale: "zh",
          slug: "nintendo-switch-oled-amazon-au",
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
        },
      ],
    });
  });

  it("returns a persisted published deal from the injected public deal store", async () => {
    const app = buildApp({
      publishedDealStore: {
        async getPublishedDeal(locale: string, slug: string) {
          if (locale !== "en" || slug !== "dyson-v8-for-a-349-at-jb-hi-fi") {
            return null;
          }

          return {
            id: "deal_live_456",
            locale: "en",
            slug: "dyson-v8-for-a-349-at-jb-hi-fi",
            title: "Dyson V8 for A$349 at JB Hi-Fi",
            summary: "Bonus tools bundle included while stock lasts.",
            category: "Home",
            locales: [
              {
                locale: "en",
                slug: "dyson-v8-for-a-349-at-jb-hi-fi",
                title: "Dyson V8 for A$349 at JB Hi-Fi",
                summary: "Bonus tools bundle included while stock lasts.",
              },
              {
                locale: "zh",
                slug: "jb-hifi-dyson-v8-a-349",
                title: "JB Hi-Fi Dyson V8 吸尘器 A$349",
                summary: "含额外工具配件，售完即止。",
              },
            ],
          };
        },
        async hasPublishedDealSlug(slug: string) {
          return slug === "dyson-v8-for-a-349-at-jb-hi-fi";
        },
      },
    } as never);

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en/dyson-v8-for-a-349-at-jb-hi-fi",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: "deal_live_456",
      locale: "en",
      slug: "dyson-v8-for-a-349-at-jb-hi-fi",
      title: "Dyson V8 for A$349 at JB Hi-Fi",
      summary: "Bonus tools bundle included while stock lasts.",
      category: "Home",
      locales: [
        {
          locale: "en",
          slug: "dyson-v8-for-a-349-at-jb-hi-fi",
          title: "Dyson V8 for A$349 at JB Hi-Fi",
          summary: "Bonus tools bundle included while stock lasts.",
        },
        {
          locale: "zh",
          slug: "jb-hifi-dyson-v8-a-349",
          title: "JB Hi-Fi Dyson V8 吸尘器 A$349",
          summary: "含额外工具配件，售完即止。",
        },
      ],
      priceContext: {
        snapshots: [],
      },
    });
  });
});
