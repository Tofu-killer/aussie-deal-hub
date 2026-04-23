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

  it("publishes a saved review draft into the public deal store", async () => {
    const publishedDeals = new Map<string, {
      locale: string;
      slug: string;
      title: string;
      summary: string;
      category: string;
    }>();
    const publishedDealStore = {
      async publishDeal(input: {
        leadId: string;
        category: string;
        locales: Array<{
          locale: string;
          slug: string;
          title: string;
          summary: string;
        }>;
      }) {
        for (const locale of input.locales) {
          publishedDeals.set(`${locale.locale}:${locale.slug}`, {
            locale: locale.locale,
            slug: locale.slug,
            title: locale.title,
            summary: locale.summary,
            category: input.category,
          });
        }

        return {
          leadId: input.leadId,
          status: "published",
          locales: input.locales.map((locale) => ({
            locale: locale.locale,
            slug: locale.slug,
          })),
        };
      },
      async getPublishedDeal(locale: string, slug: string) {
        return publishedDeals.get(`${locale}:${slug}`) ?? null;
      },
      async hasPublishedDealSlug(slug: string) {
        return Array.from(publishedDeals.values()).some((deal) => deal.slug === slug);
      },
    };
    const app = buildApp({ publishedDealStore } as never);

    const leadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_bigw",
        originalTitle: "Big W AU LEGO Bonsai Tree A$59",
        originalUrl: "https://www.bigw.com.au/deal/lego-bonsai",
        snippet: "Weekend toy sale.",
      },
    });

    expect(leadResponse.status).toBe(201);

    const leadId = String((leadResponse.body as { id: string }).id);

    const draftResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${leadId}/review`,
      body: {
        leadId,
        category: "Toys",
        confidence: 88,
        riskLabels: [],
        tags: ["lego"],
        featuredSlot: "weekend",
        publishAt: "2026-04-24T11:00:00.000Z",
        locales: {
          en: {
            title: "LEGO Bonsai Tree for A$59 at Big W",
            summary: "Weekend sale drops the LEGO display set to A$59.",
          },
          zh: {
            title: "Big W 乐高盆景树套装 A$59",
            summary: "周末玩具促销，展示款乐高套装降至 A$59。",
          },
        },
        publish: false,
      },
    });

    expect(draftResponse.status).toBe(200);

    const publishResponse = await dispatchRequest(app, {
      method: "POST",
      path: `/v1/admin/publishing/${leadId}/publish`,
    });

    expect(publishResponse.status).toBe(200);
    expect(publishResponse.body).toEqual({
      leadId,
      status: "published",
      locales: [
        {
          locale: "en",
          slug: "lego-bonsai-tree-for-a-59-at-big-w",
        },
        {
          locale: "zh",
          slug: "big-w-乐高盆景树套装-a-59",
        },
      ],
    });

    const publicDealResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en/lego-bonsai-tree-for-a-59-at-big-w",
    });

    expect(publicDealResponse.status).toBe(200);
    expect(publicDealResponse.body).toMatchObject({
      locale: "en",
      slug: "lego-bonsai-tree-for-a-59-at-big-w",
      title: "LEGO Bonsai Tree for A$59 at Big W",
      summary: "Weekend sale drops the LEGO display set to A$59.",
      category: "Toys",
      priceContext: {
        snapshots: [],
      },
    });

    const queueResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/publishing",
    });

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body).toEqual({
      items: [
        {
          id: `${leadId}:en-AU`,
          leadId,
          deal: "LEGO Bonsai Tree for A$59 at Big W",
          featuredSlot: "weekend",
          publishAt: "2026-04-24T11:00:00.000Z",
          locale: "en-AU",
          status: "scheduled",
        },
        {
          id: `${leadId}:zh-CN`,
          leadId,
          deal: "Big W 乐高盆景树套装 A$59",
          featuredSlot: "weekend",
          publishAt: "2026-04-24T11:00:00.000Z",
          locale: "zh-CN",
          status: "scheduled",
        },
      ],
    });
  });

  it("deduplicates colliding published slugs before calling the published deal store", async () => {
    const publishedDeals = new Map<string, {
      leadId: string;
      locale: string;
      slug: string;
      title: string;
      summary: string;
      category: string;
    }>();
    const publishedDealStore = {
      async publishDeal(input: {
        leadId: string;
        category: string;
        locales: Array<{
          locale: string;
          slug: string;
          title: string;
          summary: string;
        }>;
      }) {
        for (const locale of input.locales) {
          if (Array.from(publishedDeals.values()).some((deal) => deal.slug === locale.slug)) {
            throw new Error(`Duplicate slug: ${locale.slug}`);
          }
        }

        for (const locale of input.locales) {
          publishedDeals.set(`${locale.locale}:${locale.slug}`, {
            leadId: input.leadId,
            locale: locale.locale,
            slug: locale.slug,
            title: locale.title,
            summary: locale.summary,
            category: input.category,
          });
        }

        return {
          leadId: input.leadId,
          status: "published",
          locales: input.locales.map((locale) => ({
            locale: locale.locale,
            slug: locale.slug,
          })),
        };
      },
      async getPublishedDeal(locale: string, slug: string) {
        return publishedDeals.get(`${locale}:${slug}`) ?? null;
      },
      async hasPublishedDealSlug(slug: string) {
        return Array.from(publishedDeals.values()).some((deal) => deal.slug === slug);
      },
      async getPublishedDealSlugForLead(leadId: string, locale: string) {
        return Array.from(publishedDeals.values()).find(
          (deal) => deal.leadId === leadId && deal.locale === locale,
        )?.slug ?? null;
      },
    };
    const app = buildApp({ publishedDealStore } as never);

    for (const leadNumber of [1, 2]) {
      const leadResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/leads",
        body: {
          sourceId: `src_duplicate_${leadNumber}`,
          originalTitle: "Amazon AU Instant Pot Duo A$99",
          originalUrl: `https://www.amazon.com.au/deal/instant-pot-${leadNumber}`,
          snippet: "Pressure cooker promo.",
        },
      });

      expect(leadResponse.status).toBe(201);

      const leadId = String((leadResponse.body as { id: string }).id);
      const saveDraftResponse = await dispatchRequest(app, {
        method: "PUT",
        path: `/v1/admin/leads/${leadId}/review`,
        body: {
          leadId,
          category: "Kitchen",
          confidence: 90,
          riskLabels: [],
          tags: ["cooking"],
          featuredSlot: "homepage",
          publishAt: "2026-04-24T12:00:00.000Z",
          locales: {
            en: {
              title: "Instant Pot Duo for A$99 at Amazon AU",
              summary: "Electric pressure cooker deal.",
            },
            zh: {
              title: "亚马逊澳洲 Instant Pot Duo A$99",
              summary: "电压力锅促销。",
            },
          },
          publish: false,
        },
      });

      expect(saveDraftResponse.status).toBe(200);
    }

    const firstPublishResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/publishing/lead_1/publish",
    });
    const secondPublishResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/publishing/lead_2/publish",
    });

    expect(firstPublishResponse.status).toBe(200);
    expect(firstPublishResponse.body).toEqual({
      leadId: "lead_1",
      status: "published",
      locales: [
        {
          locale: "en",
          slug: "instant-pot-duo-for-a-99-at-amazon-au",
        },
        {
          locale: "zh",
          slug: "亚马逊澳洲-instant-pot-duo-a-99",
        },
      ],
    });
    expect(secondPublishResponse.status).toBe(200);
    expect(secondPublishResponse.body).toEqual({
      leadId: "lead_2",
      status: "published",
      locales: [
        {
          locale: "en",
          slug: "instant-pot-duo-for-a-99-at-amazon-au-2",
        },
        {
          locale: "zh",
          slug: "亚马逊澳洲-instant-pot-duo-a-99-2",
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
