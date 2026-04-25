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

  it("returns a deterministic review preview from the admin detail read endpoint when no draft is saved", async () => {
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
    expect(detailResponse.body).toEqual({
      ...leadResponse.body,
      review: {
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
      },
    });
  });

  it("returns raw evidence fields for leads that were manually created", async () => {
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
    expect(leadResponse.body).toMatchObject({
      sourceScore: null,
      sourceSnapshot: null,
    });
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

  it("marks a queued review as published after it is materialized into the public catalog", async () => {
    const app = buildApp();

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
        publish: true,
      },
    });
    const publishResponse = await dispatchRequest(app, {
      method: "POST",
      path: `/v1/admin/publishing/${leadId}/publish`,
    });

    expect(draftResponse.status).toBe(200);
    expect(publishResponse.status).toBe(200);

    const queueResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads",
    });

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body).toMatchObject({
      items: [
        {
          id: leadId,
          queue: {
            status: "published",
            label: "Published",
          },
        },
      ],
    });
  });

  it("discards a lead and removes it from the admin queue", async () => {
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
    const discardResponse = await dispatchRequest(app, {
      method: "POST",
      path: `/v1/admin/leads/${leadId}/discard`,
    });

    expect(discardResponse.status).toBe(204);

    const queueResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/leads",
    });

    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body).toEqual({
      items: [],
    });
  });

  it("reruns AI review and persists the regenerated draft for an existing lead", async () => {
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
    const savedDraftResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/leads/${leadId}/review`,
      body: {
        leadId,
        category: "Deals",
        confidence: 91,
        riskLabels: ["Limited stock"],
        tags: ["gaming"],
        featuredSlot: "hero",
        publishAt: "2026-04-24T10:30:00.000Z",
        locales: {
          en: {
            title: "Manually edited title",
            summary: "Manually edited summary.",
          },
          zh: {
            title: "人工修改标题",
            summary: "人工修改摘要。",
          },
        },
        publish: true,
      },
    });

    expect(savedDraftResponse.status).toBe(200);

    const rerunResponse = await dispatchRequest(app, {
      method: "POST",
      path: `/v1/admin/leads/${leadId}/rerun-review`,
    });

    expect(rerunResponse.status).toBe(200);
    expect(rerunResponse.body).toMatchObject({
      leadId,
      category: "Deals",
      confidence: 88,
      riskLabels: [],
      tags: ["gaming"],
      featuredSlot: "hero",
      publishAt: "2026-04-24T10:30:00.000Z",
      publish: true,
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

    const detailResponse = await dispatchRequest(app, {
      method: "GET",
      path: `/v1/admin/leads/${leadId}`,
    });

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body).toEqual(
      expect.objectContaining({
        ...leadResponse.body,
        review: expect.objectContaining({
          leadId,
          category: "Deals",
          confidence: 88,
          riskLabels: [],
          tags: ["gaming"],
          featuredSlot: "hero",
          publishAt: "2026-04-24T10:30:00.000Z",
          publish: true,
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
          updatedAt: expect.any(String),
        }),
      }),
    );
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
      expect(detailResponse.body).toEqual({
        ...createResponse.body,
        review: {
          category: "Deals",
          confidence: 88,
          riskLabels: [],
          locales: {
            en: {
              title: "AU Dyson V8 for A$349 at JB Hi-Fi",
              summary: "Bonus tools bundle included.",
            },
            zh: {
              title: "JB Hi-Fi AU Dyson V8 到手 A$349",
              summary: "JB Hi-Fi 的 AU Dyson V8 价格来到 A$349。",
            },
          },
        },
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

  it("persists discarded leads outside the admin queue across app rebuilds", async () => {
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
          snippet: "Limited run.",
        },
      });

      expect(leadResponse.status).toBe(201);

      const leadId = String((leadResponse.body as { id: string }).id);
      const discardResponse = await dispatchRequest(app, {
        method: "POST",
        path: `/v1/admin/leads/${leadId}/discard`,
      });

      expect(discardResponse.status).toBe(204);

      const rebuiltApp = await buildDbApp();
      const queueResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: "/v1/admin/leads",
      });

      expect(queueResponse.status).toBe(200);
      expect((queueResponse.body as { items: Array<{ id: string }> }).items).not.toContainEqual(
        expect.objectContaining({
          id: leadId,
        }),
      );
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

  it("persists source score and snapshot for ingestion-created leads across app rebuilds", async () => {
    const sourceId = `src_ingest_${randomUUID()}`;
    const { createAdminLeadRepository } = await import("@aussie-deal-hub/db/repositories/leads");
    const repository = createAdminLeadRepository();

    try {
      const created = await repository.createLeadIfNew({
        sourceId,
        originalTitle: "Amazon AU Kindle Paperwhite A$179",
        originalUrl: `https://www.amazon.com.au/deal/${sourceId}`,
        canonicalUrl: `https://www.amazon.com.au/deal/${sourceId}`,
        snippet: "Ingestion evidence snippet.",
        sourceScore: 84,
        sourceSnapshot: JSON.stringify({
          source: {
            id: sourceId,
            name: "Amazon AU Feed",
          },
          candidate: {
            title: "Amazon AU Kindle Paperwhite A$179",
            url: `https://www.amazon.com.au/deal/${sourceId}`,
          },
        }),
      });

      expect(created.created).toBe(true);

      const rebuiltApp = await buildDbApp();
      const detailResponse = await dispatchRequest(rebuiltApp, {
        method: "GET",
        path: `/v1/admin/leads/${created.lead.id}`,
      });

      expect(detailResponse.status).toBe(200);
      expect(detailResponse.body).toEqual(
        expect.objectContaining({
          id: created.lead.id,
          sourceScore: 84,
          sourceSnapshot: expect.stringContaining("\"candidate\""),
        }),
      );
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
