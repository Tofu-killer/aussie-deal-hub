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
          locale: "en",
          slug: "nintendo-switch-oled-amazon-au",
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
          category: "Deals",
          merchant: "Amazon AU",
          currentPrice: "399.00",
          affiliateUrl: "https://www.amazon.com.au/deal",
          publishedAt: "2025-04-15T00:00:00.000Z",
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
              locale: "en",
              slug: "breville-barista-express-for-a-499",
              title: "Breville Barista Express for A$499",
              summary: "Live catalog deal loaded from the persisted public store.",
              category: "Kitchen",
              merchant: "The Good Guys",
              currentPrice: "499.00",
              affiliateUrl: "https://www.thegoodguys.com.au/deal",
              publishedAt: "2026-04-23T01:00:00.000Z",
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
          locale: "en",
          slug: "breville-barista-express-for-a-499",
          title: "Breville Barista Express for A$499",
          summary: "Live catalog deal loaded from the persisted public store.",
          category: "Kitchen",
          merchant: "The Good Guys",
          currentPrice: "499.00",
          affiliateUrl: "https://www.thegoodguys.com.au/deal",
          publishedAt: "2026-04-23T01:00:00.000Z",
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
      locale: "en",
      slug: "nintendo-switch-oled-amazon-au",
      title: "Nintendo Switch OLED for A$399 at Amazon AU",
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
            locale: "en",
            slug: "dyson-v8-for-a-349-at-jb-hi-fi",
            title: "Dyson V8 for A$349 at JB Hi-Fi",
            summary: "Bonus tools bundle included while stock lasts.",
            category: "Home",
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
      locale: "en",
      slug: "dyson-v8-for-a-349-at-jb-hi-fi",
      title: "Dyson V8 for A$349 at JB Hi-Fi",
      summary: "Bonus tools bundle included while stock lasts.",
      category: "Home",
      priceContext: {
        snapshots: [],
      },
    });
  });
});
