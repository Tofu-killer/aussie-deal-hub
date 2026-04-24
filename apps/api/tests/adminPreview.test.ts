import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("admin preview routes", () => {
  it("rejects invalid review preview payloads", async () => {
    const app = buildApp();

    const invalidBodies = [
      {
        snippet: "Coupon GAME20 expires tonight.",
      },
      {
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        snippet: 399,
      },
      "not-an-object",
    ];

    for (const body of invalidBodies) {
      const response = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/review-preview",
        body,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: "Lead payload is invalid.",
      });
    }
  });

  it("returns identical review preview JSON for repeated requests with the same payload", async () => {
    const app = buildApp();
    const payload = {
      originalTitle: "Amazon AU Nintendo Switch OLED A$399",
      snippet: "Coupon GAME20 expires tonight.",
    };

    const firstResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/review-preview",
      body: payload,
    });
    const secondResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/review-preview",
      body: payload,
    });

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.body).toEqual(secondResponse.body);
    expect(firstResponse.body).toEqual({
      category: "Deals",
      confidence: 88,
      riskLabels: [],
      locales: {
        en: {
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Coupon GAME20 expires tonight.",
        },
        zh: {
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          summary: "优惠码 GAME20 今晚到期。",
        },
      },
    });
  });

  it("returns a deterministic bilingual digest preview payload", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/digest-preview",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      en: {
        locale: "en",
        subject: "Daily Deals Digest",
      },
      zh: {
        locale: "zh",
        subject: "每日捡漏摘要",
      },
    });
    expect(response.body).toMatchObject({
      en: {
        deals: [
          {
            id: "nintendo-switch-oled-amazon-au",
            merchant: "Amazon AU",
            title: "Nintendo Switch OLED for A$399 at Amazon AU",
          },
          {
            id: "kindle-paperwhite-amazon-au",
            merchant: "Amazon AU",
            title: "Kindle Paperwhite for A$179 at Amazon AU",
          },
          {
            id: "dyson-v8-the-good-guys",
            merchant: "The Good Guys",
            title: "Dyson V8 for A$499 at The Good Guys",
          },
        ],
      },
      zh: {
        deals: [
          {
            id: "nintendo-switch-oled-amazon-au",
            merchant: "亚马逊澳洲",
            title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          },
          {
            id: "kindle-paperwhite-amazon-au",
            merchant: "亚马逊澳洲",
            title: "亚马逊澳洲 Kindle Paperwhite 到手 A$179",
          },
          {
            id: "dyson-v8-the-good-guys",
            merchant: "The Good Guys",
            title: "The Good Guys Dyson V8 到手 A$499",
          },
        ],
      },
    });
    expect((response.body as { en: { deals: unknown[] } }).en.deals).toEqual([
      {
        id: "nintendo-switch-oled-amazon-au",
        merchant: "Amazon AU",
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
      },
      {
        id: "kindle-paperwhite-amazon-au",
        merchant: "Amazon AU",
        title: "Kindle Paperwhite for A$179 at Amazon AU",
      },
      {
        id: "dyson-v8-the-good-guys",
        merchant: "The Good Guys",
        title: "Dyson V8 for A$499 at The Good Guys",
      },
    ]);
    expect((response.body as { zh: { deals: unknown[] } }).zh.deals).toEqual([
      {
        id: "nintendo-switch-oled-amazon-au",
        merchant: "亚马逊澳洲",
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      },
      {
        id: "kindle-paperwhite-amazon-au",
        merchant: "亚马逊澳洲",
        title: "亚马逊澳洲 Kindle Paperwhite 到手 A$179",
      },
      {
        id: "dyson-v8-the-good-guys",
        merchant: "The Good Guys",
        title: "The Good Guys Dyson V8 到手 A$499",
      },
    ]);
    expect(response.body).toMatchObject({
      en: {
        html: expect.stringContaining("Nintendo Switch OLED for A$399 at Amazon AU"),
      },
      zh: {
        html: expect.stringContaining("亚马逊澳洲 Nintendo Switch OLED 到手 A$399"),
      },
    });
  });

  it("uses the configured published deal store for digest preview when available", async () => {
    const app = buildApp({
      publishedDealStore: {
        async getPublishedDeal() {
          return null;
        },
        async hasPublishedDealSlug() {
          return false;
        },
        async listPublishedDeals(locale: string) {
          if (locale === "en") {
            return [
              {
                locale: "en",
                slug: "worker-live-en",
                title: "Worker Live Deal EN",
                summary: "Worker generated English summary.",
                category: "Deals",
                merchant: "Worker Merchant",
                currentPrice: "123",
                affiliateUrl: "https://example.test/en",
                publishedAt: "2026-04-24T00:00:00.000Z",
              },
            ];
          }

          return [
            {
              locale: "zh",
              slug: "worker-live-zh",
              title: "Worker Live Deal ZH",
              summary: "Worker generated Chinese summary.",
              category: "Deals",
              merchant: "实时商家",
              currentPrice: "123",
              affiliateUrl: "https://example.test/zh",
              publishedAt: "2026-04-24T00:00:00.000Z",
            },
          ];
        },
        async publishDeal() {
          return {
            leadId: "lead_1",
            status: "published",
            locales: [],
          };
        },
        async getPublishedDealSlugForLead() {
          return null;
        },
      },
    } as never);

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/digest-preview",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      en: {
        deals: [
          {
            id: "worker-live-en",
            merchant: "Worker Merchant",
            title: "Worker Live Deal EN",
          },
        ],
      },
      zh: {
        deals: [
          {
            id: "worker-live-zh",
            merchant: "实时商家",
            title: "Worker Live Deal ZH",
          },
        ],
      },
    });
  });
});
