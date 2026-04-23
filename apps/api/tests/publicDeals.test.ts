import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("public deals", () => {
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
