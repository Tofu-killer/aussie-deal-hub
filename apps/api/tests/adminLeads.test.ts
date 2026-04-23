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

  it("lists created leads from the admin queue read endpoint", async () => {
    const app = buildApp();

    const firstLeadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      }
    });
    const secondLeadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_ebay",
        originalTitle: "eBay AU AirPods Pro 2 A$299",
        originalUrl: "https://www.ebay.com.au/deal",
        snippet: "Plus members save another A$20.",
      }
    });

    expect(firstLeadResponse.status).toBe(201);
    expect(secondLeadResponse.status).toBe(201);

    const queueResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads",
    });

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body).toEqual({
      items: [
        {
          ...firstLeadResponse.body,
          queue: {
            status: "pending_review",
            label: "Pending review",
          },
        },
        {
          ...secondLeadResponse.body,
          queue: {
            status: "pending_review",
            label: "Pending review",
          },
        },
      ],
    });
  });

  it("returns a stored lead from the admin detail read endpoint", async () => {
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

    const detailResponse = await dispatchRequest(app, {
      method: "GET",
      path: `/v1/admin/leads/${String((leadResponse.body as { id: string }).id)}`
    });

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toEqual(leadResponse.body);
  });

  it("returns 404 when the admin detail read endpoint cannot find the lead", async () => {
    const app = buildApp();

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads/lead_missing"
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      message: "Lead not found."
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

  it("stores submitted review drafts for an existing lead and returns them from the detail endpoint", async () => {
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

    const leadId = String((leadResponse.body as { id: string }).id);
    const draftPayload = {
      leadId,
      category: "Deals",
      confidence: 91,
      riskLabels: ["Limited stock"],
      tags: ["gaming", "console"],
      featuredSlot: "hero",
      publishAt: "2026-04-24T10:30:00.000Z",
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
    };

    const saveDraftResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${leadId}/review`,
      body: draftPayload,
    });

    expect(saveDraftResponse.status).toBe(200);
    expect(saveDraftResponse.body).toMatchObject(draftPayload);
    expect(saveDraftResponse.body).toEqual(
      expect.objectContaining({
        updatedAt: expect.any(String),
      }),
    );

    const detailResponse = await dispatchRequest(app, {
      method: "GET",
      path: `/v1/admin/leads/${leadId}`
    });

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toEqual(
      expect.objectContaining({
        ...leadResponse.body,
        review: expect.objectContaining(draftPayload),
      }),
    );
  });

  it("rejects review drafts with non-integer confidence before persistence", async () => {
    const app = buildApp();

    const leadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      },
    });

    expect(leadResponse.status).toBe(201);

    const leadId = String((leadResponse.body as { id: string }).id);
    const response = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${leadId}/review`,
      body: {
        leadId,
        category: "Deals",
        confidence: 91.5,
        riskLabels: ["Limited stock"],
        tags: ["gaming", "console"],
        featuredSlot: "hero",
        publishAt: "2026-04-24T10:30:00.000Z",
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

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: "Review draft payload is invalid.",
    });
  });

  it("rejects review drafts with invalid publishAt strings before persistence", async () => {
    const app = buildApp();

    const leadResponse = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/leads",
      body: {
        sourceId: "src_amazon",
        originalTitle: "Amazon AU Nintendo Switch OLED A$399",
        originalUrl: "https://www.amazon.com.au/deal",
        snippet: "Coupon GAME20 expires tonight.",
      },
    });

    expect(leadResponse.status).toBe(201);

    const leadId = String((leadResponse.body as { id: string }).id);
    const response = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${leadId}/review`,
      body: {
        leadId,
        category: "Deals",
        confidence: 91,
        riskLabels: ["Limited stock"],
        tags: ["gaming", "console"],
        featuredSlot: "hero",
        publishAt: "tomorrow morning maybe",
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

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: "Review draft payload is invalid.",
    });
  });

  it("returns saved draft and queued review status summaries from the admin queue read endpoint", async () => {
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

    const firstLeadId = String((firstLeadResponse.body as { id: string }).id);
    const secondLeadId = String((secondLeadResponse.body as { id: string }).id);

    const savedDraftResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${firstLeadId}/review`,
      body: {
        leadId: firstLeadId,
        category: "Deals",
        confidence: 88,
        riskLabels: ["Limited stock"],
        tags: ["gaming"],
        featuredSlot: "sidebar",
        publishAt: "2026-04-24T09:00:00.000Z",
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
        publish: false,
      },
    });
    const queuedReviewResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${secondLeadId}/review`,
      body: {
        leadId: secondLeadId,
        category: "Audio",
        confidence: 91,
        riskLabels: ["Members only"],
        tags: ["audio", "earbuds"],
        featuredSlot: "hero",
        publishAt: "2026-04-24T10:30:00.000Z",
        locales: {
          en: {
            title: "AirPods Pro 2 for A$299 at eBay AU",
            summary: "Plus members save another A$20.",
          },
          zh: {
            title: "eBay 澳洲 AirPods Pro 2 到手 A$299",
            summary: "Plus 会员再减 A$20。",
          },
        },
        publish: true,
      },
    });

    expect(savedDraftResponse.status).toBe(200);
    expect(queuedReviewResponse.status).toBe(200);

    const queueResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads",
    });

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body).toEqual({
      items: [
        expect.objectContaining({
          ...firstLeadResponse.body,
          queue: {
            status: "draft_saved",
            label: "Draft saved",
          },
          review: expect.objectContaining({
            leadId: firstLeadId,
            publish: false,
            updatedAt: expect.any(String),
          }),
        }),
        expect.objectContaining({
          ...secondLeadResponse.body,
          queue: {
            status: "queued_to_publish",
            label: "Queued to publish",
          },
          review: expect.objectContaining({
            leadId: secondLeadId,
            publish: true,
            updatedAt: expect.any(String),
          }),
        }),
      ],
    });
  });
});

describeDb("admin lead persistence", () => {
  it("persists created leads across app rebuilds", async () => {
    const sourceId = `src_admin_${randomUUID()}`;
    const app = await buildDbApp();

    try {
      const createResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/leads",
        body: {
          sourceId,
          originalTitle: "JB Hi-Fi AU Dyson V8 A$349",
          originalUrl: `https://www.jbhifi.com.au/deal/${sourceId}`,
          snippet: "Bonus tools bundle included.",
        },
      });

      expect(createResponse.status).toBe(201);

      const leadId = String((createResponse.body as { id: string }).id);
      const rebuiltApp = await buildDbApp();

      const queueResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: "/v1/admin/leads",
      });

      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body).toEqual({
        items: expect.arrayContaining([
          {
            ...createResponse.body,
            queue: {
              status: "pending_review",
              label: "Pending review",
            },
          },
        ]),
      });

      const detailResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: `/v1/admin/leads/${leadId}`,
      });

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body).toEqual(createResponse.body);
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

  it("persists saved review drafts across app rebuilds for detail and queue reads", async () => {
    const sourceId = `src_admin_${randomUUID()}`;
    const app = await buildDbApp();

    try {
      const leadResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/leads",
        body: {
          sourceId,
          originalTitle: "Amazon AU Meta Quest 3S A$449",
          originalUrl: `https://www.amazon.com.au/deal/${sourceId}`,
          snippet: "Limited bundle with store credit.",
        },
      });

      expect(leadResponse.status).toBe(201);

      const leadId = String((leadResponse.body as { id: string }).id);
      const draftPayload = {
        leadId,
        category: "VR",
        confidence: 93,
        riskLabels: ["Bundle stock may vary"],
        tags: ["vr", "gaming", "featured"],
        featuredSlot: "hero",
        publishAt: "2026-04-25T09:30:00.000Z",
        locales: {
          en: {
            title: "Meta Quest 3S bundle for A$449 at Amazon AU",
            summary: "Bundle includes store credit while stock lasts.",
          },
          zh: {
            title: "亚马逊澳洲 Meta Quest 3S 套装 A$449",
            summary: "套装附带礼品卡，库存有限。",
          },
        },
        publish: true,
      };

      const saveDraftResponse = await dispatchRequest(app, {
        method: "PUT",
        path: `/v1/admin/leads/${leadId}/review`,
        body: draftPayload,
      });

      expect(saveDraftResponse.status).toBe(200);

      const rebuiltApp = await buildDbApp();
      const detailResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: `/v1/admin/leads/${leadId}`,
      });

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body).toEqual(
        expect.objectContaining({
          ...leadResponse.body,
          review: expect.objectContaining({
            ...draftPayload,
            updatedAt: expect.any(String),
          }),
        }),
      );

      const queueResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: "/v1/admin/leads",
      });

      expect(queueResponse.status).toBe(200);
      expect(queueResponse.body).toEqual({
        items: expect.arrayContaining([
          expect.objectContaining({
            ...leadResponse.body,
            queue: {
              status: "queued_to_publish",
              label: "Queued to publish",
            },
            review: expect.objectContaining({
              leadId,
              category: "VR",
              confidence: 93,
              riskLabels: ["Bundle stock may vary"],
              tags: ["vr", "gaming", "featured"],
              featuredSlot: "hero",
              publishAt: "2026-04-25T09:30:00.000Z",
              publish: true,
              updatedAt: expect.any(String),
            }),
          }),
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
