import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const runDbTests = process.env.RUN_DB_TESTS === "1";

if (runDbTests && !process.env.DATABASE_URL) {
  throw new Error("RUN_DB_TESTS=1 requires DATABASE_URL to be set.");
}

const describeDb = runDbTests ? describe : describe.skip;

async function buildDbApp() {
  const { createAdminLeadRepository } = await import("@aussie-deal-hub/db/repositories/leads");

  return buildApp({
    adminLeadStore: createAdminLeadRepository(),
  } as never);
}

describe("admin publishing queue", () => {
  it("lists locale-specific publishing queue items derived from saved review drafts", async () => {
    const app = buildApp();

    const firstLeadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      },
    });
    const secondLeadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_ebay",
        originalTitle: "eBay AU AirPods Pro 2 A$299",
        originalUrl: "https://www.ebay.com.au/deal",
        snippet: "Plus members save another A$20.",
      },
    });

    expect(firstLeadResponse.status).toBe(201);
    expect(secondLeadResponse.status).toBe(201);

    const firstLeadId = String((firstLeadResponse.body as { id: string }).id);
    const secondLeadId = String((secondLeadResponse.body as { id: string }).id);

    const firstReviewResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${firstLeadId}/review`,
      body: {
        leadId: firstLeadId,
        category: "Deals",
        confidence: 91,
        riskLabels: ["Limited stock"],
        tags: ["gaming", "console"],
        featuredSlot: "hero",
        publishAt: "2026-04-24T09:00:00.000Z",
        locales: {
          en: {
            title: "Nintendo Switch OLED bundle for A$399 at Amazon AU",
            summary: "Updated English summary.",
          },
          zh: {
            title: "亚马逊澳洲 Nintendo Switch OLED 套装到手 A$399",
            summary: "更新后的中文摘要。",
          },
        },
        publish: true,
      },
    });
    const secondReviewResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${secondLeadId}/review`,
      body: {
        leadId: secondLeadId,
        category: "Deals",
        confidence: 83,
        riskLabels: [],
        tags: ["audio"],
        featuredSlot: "sidebar",
        publishAt: "2026-04-24T09:05:00.000Z",
        locales: {
          en: {
            title: "AirPods Pro 2 for A$299 at eBay AU",
            summary: "Members save another A$20.",
          },
          zh: {
            title: "eBay 澳洲 AirPods Pro 2 到手 A$299",
            summary: "会员再减 A$20。",
          },
        },
        publish: false,
      },
    });

    expect(firstReviewResponse.status).toBe(200);
    expect(secondReviewResponse.status).toBe(200);

    const queueResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/publishing",
    });

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body).toEqual({
      items: [
        {
          id: `${firstLeadId}:en-AU`,
          leadId: firstLeadId,
          deal: "Nintendo Switch OLED bundle for A$399 at Amazon AU",
          featuredSlot: "hero",
          publishAt: "2026-04-24T09:00:00.000Z",
          locale: "en-AU",
          status: "scheduled",
        },
        {
          id: `${firstLeadId}:zh-CN`,
          leadId: firstLeadId,
          deal: "亚马逊澳洲 Nintendo Switch OLED 套装到手 A$399",
          featuredSlot: "hero",
          publishAt: "2026-04-24T09:00:00.000Z",
          locale: "zh-CN",
          status: "scheduled",
        },
        {
          id: `${secondLeadId}:en-AU`,
          leadId: secondLeadId,
          deal: "AirPods Pro 2 for A$299 at eBay AU",
          featuredSlot: "sidebar",
          publishAt: "2026-04-24T09:05:00.000Z",
          locale: "en-AU",
          status: "ready",
        },
        {
          id: `${secondLeadId}:zh-CN`,
          leadId: secondLeadId,
          deal: "eBay 澳洲 AirPods Pro 2 到手 A$299",
          featuredSlot: "sidebar",
          publishAt: "2026-04-24T09:05:00.000Z",
          locale: "zh-CN",
          status: "ready",
        },
      ],
    });
  });
});

describeDb("admin publishing persistence", () => {
  it("reads persisted publishing queue items after rebuilding the app", async () => {
    const sourceId = `src_admin_${randomUUID()}`;
    const app = await buildDbApp();

    try {
      const leadResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/leads",
        body: {
          sourceId,
          originalTitle: "Amazon AU Kindle Paperwhite A$179",
          originalUrl: `https://www.amazon.com.au/deal/${sourceId}`,
          snippet: "Prime members get next-day delivery.",
        },
      });

      expect(leadResponse.status).toBe(201);

      const leadId = String((leadResponse.body as { id: string }).id);

      const saveDraftResponse = await dispatchRequest(app, {
        method: "PUT",
        path: `/v1/admin/leads/${leadId}/review`,
        body: {
          leadId,
          category: "Deals",
          confidence: 89,
          riskLabels: ["Prime shipping timing may vary"],
          tags: ["ebooks", "reading"],
          featuredSlot: "digest-primary",
          publishAt: "2026-04-26T07:45:00.000Z",
          locales: {
            en: {
              title: "Kindle Paperwhite for A$179 at Amazon AU",
              summary: "Prime members get next-day delivery.",
            },
            zh: {
              title: "亚马逊澳洲 Kindle Paperwhite 到手 A$179",
              summary: "Prime 会员可享次日达。",
            },
          },
          publish: false,
        },
      });

      expect(saveDraftResponse.status).toBe(200);

      const rebuiltApp = await buildDbApp();
      const queueResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: "/v1/admin/publishing",
      });

      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body).toEqual({
        items: expect.arrayContaining([
          {
            id: `${leadId}:en-AU`,
            leadId,
            deal: "Kindle Paperwhite for A$179 at Amazon AU",
            featuredSlot: "digest-primary",
            publishAt: "2026-04-26T07:45:00.000Z",
            locale: "en-AU",
            status: "ready",
          },
          {
            id: `${leadId}:zh-CN`,
            leadId,
            deal: "亚马逊澳洲 Kindle Paperwhite 到手 A$179",
            featuredSlot: "digest-primary",
            publishAt: "2026-04-26T07:45:00.000Z",
            locale: "zh-CN",
            status: "ready",
          },
        ]),
      });
    } finally {
      await prisma.lead.deleteMany({
        where: {
          sourceId,
        },
      });
      await prisma.source.deleteMany({
        where: {
          id: sourceId,
        },
      });
    }
  });
});
