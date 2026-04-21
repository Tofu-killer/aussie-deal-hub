import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

describe("admin lead pipeline", () => {
  it("rejects invalid lead payloads before they enter the review flow", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_amazon"
      }
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: "Lead payload is invalid."
    });
  });

  it("creates a lead and returns deterministic AI review output", async () => {
    const app = buildApp();

    const leadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      }
    });

    expect(leadResponse.status).toBe(201);

    const reviewResponse = await dispatchRequest(app, {
      method: "POST",
      path: `/v1/admin/leads/${String((leadResponse.body as { id: string }).id)}/review`
    });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body).toMatchObject({
      category: "Deals",
      confidence: 88,
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
});
