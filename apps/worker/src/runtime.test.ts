import { describe, expect, it, vi } from "vitest";

import {
  buildAutoReviewDraft,
  buildWorkerLeadRecords,
  getDefaultFeaturedSlot,
  runWorkerCycle,
} from "./runtime";
import { resolveWorkerStatePath } from "./state";

describe("worker runtime helpers", () => {
  it("maps reviewed leads into saved draft submissions with stable defaults", () => {
    const draft = buildAutoReviewDraft({
      id: "lead_1",
      originalTitle: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
      snippet: "Coupon GAME20 expires tonight.",
      reviewStatus: "reviewed",
      reviewedAt: "2026-04-24T00:00:00.000Z",
      category: "Deals",
      aiConfidence: 88,
      riskLabels: [],
      localizedHints: ["en", "zh"],
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

    expect(draft).toEqual({
      leadId: "lead_1",
      category: "Deals",
      confidence: 88,
      riskLabels: [],
      tags: [],
      featuredSlot: "hero",
      publishAt: "2026-04-24T00:00:00.000Z",
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
    });
  });

  it("prefers source names when mapping worker records for publishing", () => {
    expect(
      buildWorkerLeadRecords([
        {
          lead: {
            id: "lead_1",
            sourceId: "src_amazon",
            sourceName: "Amazon AU",
            originalTitle: "Nintendo Switch OLED",
            originalUrl: "https://example.test/deal",
            snippet: "Snippet",
            createdAt: "2026-04-24T00:00:00.000Z",
          },
          review: null,
        },
      ])[0],
    ).toMatchObject({
      lead: {
        sourceName: "Amazon AU",
      },
    });
  });

  it("runs a full worker cycle and publishes queued reviewed leads", async () => {
    const listLeadRecords = vi
      .fn()
      .mockResolvedValueOnce([
        {
          lead: {
            id: "lead_pending",
            sourceId: "src_amazon",
            sourceName: "Amazon AU",
            originalTitle: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
            originalUrl: "https://example.test/pending",
            snippet: "Coupon GAME20 expires tonight.",
            createdAt: "2026-04-24T00:00:00.000Z",
          },
          review: null,
        },
        {
          lead: {
            id: "lead_due",
            sourceId: "src_costco",
            sourceName: "Costco AU",
            originalTitle: "AirPods Pro (2nd Gen)",
            originalUrl: "https://example.test/due",
            snippet: "Warehouse promo.",
            createdAt: "2026-04-24T00:00:00.000Z",
          },
          review: {
            leadId: "lead_due",
            category: "Deals",
            confidence: 91,
            riskLabels: [],
            tags: [],
            featuredSlot: "hero",
            publishAt: "2026-04-20T00:00:00.000Z",
            locales: {
              en: {
                title: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
                summary: "Warehouse promo.",
              },
              zh: {
                title: "Costco 澳洲 AirPods Pro（第二代）A$299",
                summary: "仓储促销。",
              },
            },
            publish: true,
            updatedAt: "2026-04-24T00:00:00.000Z",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          lead: {
            id: "lead_pending",
            sourceId: "src_amazon",
            sourceName: "Amazon AU",
            originalTitle: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
            originalUrl: "https://example.test/pending",
            snippet: "Coupon GAME20 expires tonight.",
            createdAt: "2026-04-24T00:00:00.000Z",
          },
          review: {
            leadId: "lead_pending",
            category: "Deals",
            confidence: 88,
            riskLabels: [],
            tags: [],
            featuredSlot: "hero",
            publishAt: "2026-04-24T00:00:00.000Z",
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
            updatedAt: "2026-04-24T00:00:00.000Z",
          },
        },
        {
          lead: {
            id: "lead_due",
            sourceId: "src_costco",
            sourceName: "Costco AU",
            originalTitle: "AirPods Pro (2nd Gen)",
            originalUrl: "https://example.test/due",
            snippet: "Warehouse promo.",
            createdAt: "2026-04-24T00:00:00.000Z",
          },
          review: {
            leadId: "lead_due",
            category: "Deals",
            confidence: 91,
            riskLabels: [],
            tags: [],
            featuredSlot: "hero",
            publishAt: "2026-04-20T00:00:00.000Z",
            locales: {
              en: {
                title: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
                summary: "Warehouse promo.",
              },
              zh: {
                title: "Costco 澳洲 AirPods Pro（第二代）A$299",
                summary: "仓储促销。",
              },
            },
            publish: true,
            updatedAt: "2026-04-24T00:00:00.000Z",
          },
        },
      ]);
    const saveLeadReviewDraft = vi.fn().mockResolvedValue(null);
    const createLeadIfNew = vi.fn().mockResolvedValue({ created: false });
    const publishDeal = vi.fn().mockImplementation(async (input) => ({
      leadId: input.leadId,
      status: "published",
      locales: input.locales.map((locale: { locale: string; slug: string }) => ({
        locale: locale.locale,
        slug: locale.slug,
      })),
    }));
    const log = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const summary = await runWorkerCycle({
      leadStore: {
        createLeadIfNew,
        listLeadRecords,
        saveLeadReviewDraft,
      },
      publishedDealStore: {
        getPublishedDealSlugForLead: vi.fn().mockResolvedValue(null),
        hasPublishedDealSlug: vi.fn().mockResolvedValue(false),
        publishDeal,
      },
      sourceStore: {
        listEnabledSources: vi.fn().mockResolvedValue([]),
        recordSourcePoll: vi.fn().mockResolvedValue(undefined),
      },
      sourceFetcher: {
        fetch: vi.fn(),
      },
      log,
    });

    expect(createLeadIfNew).not.toHaveBeenCalled();
    expect(saveLeadReviewDraft).toHaveBeenCalledTimes(1);
    expect(publishDeal).toHaveBeenCalledTimes(1);
    expect(publishDeal.mock.calls[0]?.[0]).toMatchObject({
      leadId: "lead_due",
      merchant: "Costco AU",
    });
    expect(summary).toMatchObject({
      ingestedLeadCount: 0,
      polledSourceCount: 0,
      reviewedCount: 1,
      publishedCount: 1,
      queuedPublishCount: 1,
      queuedReviewCount: 1,
    });
  });

  it("returns stable featured slots for each review category", () => {
    expect(getDefaultFeaturedSlot("Deals")).toBe("hero");
    expect(getDefaultFeaturedSlot("Historical Lows")).toBe("historical-lows");
    expect(getDefaultFeaturedSlot("Freebies")).toBe("freebies");
    expect(getDefaultFeaturedSlot("Gift Card Offers")).toBe("gift-card-offers");
  });

  it("resolves a worker state path inside the runtime directory by default", () => {
    expect(resolveWorkerStatePath()).toContain(".runtime/worker-state.json");
  });

  it("passes source fetch metadata into ingestion during the worker cycle", async () => {
    const sourceFetcher = {
      fetch: vi.fn().mockResolvedValue({
        body: JSON.stringify({
          items: [
            {
              title: "Nintendo Switch OLED for A$399 at Amazon AU",
              url: "https://source.example/deals/switch",
              snippet: "Fresh candidate",
            },
          ],
        }),
        contentType: "application/json",
      }),
    };
    const recordSourcePoll = vi.fn().mockResolvedValue(undefined);

    const summary = await runWorkerCycle({
      leadStore: {
        createLeadIfNew: vi.fn().mockResolvedValue({ created: true }),
        listLeadRecords: vi.fn().mockResolvedValue([]),
        saveLeadReviewDraft: vi.fn().mockResolvedValue(null),
      },
      publishedDealStore: {
        getPublishedDealSlugForLead: vi.fn().mockResolvedValue(null),
        hasPublishedDealSlug: vi.fn().mockResolvedValue(false),
        publishDeal: vi.fn(),
      },
      sourceStore: {
        listEnabledSources: vi.fn().mockResolvedValue([
          {
            id: "source_1",
            name: "Amazon AU API",
            sourceType: "community",
            baseUrl: "https://source.example/api/deals",
            fetchMethod: "json",
            pollIntervalMinutes: 30,
            trustScore: 80,
            language: "en",
            lastPolledAt: null,
          },
        ]),
        recordSourcePoll,
      },
      sourceFetcher,
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(sourceFetcher.fetch).toHaveBeenCalledWith({
      url: "https://source.example/api/deals",
      fetchMethod: "json",
    });
    expect(recordSourcePoll).toHaveBeenCalledWith({
      sourceId: "source_1",
      createdLeadCount: 1,
      message: "Fetched 1 candidates; created 1 leads.",
      status: "ok",
    });
    expect(summary).toMatchObject({
      ingestedLeadCount: 1,
      polledSourceCount: 1,
      reviewedCount: 0,
      publishedCount: 0,
    });
  });

  it("sends daily digests when digest delivery dependencies are configured", async () => {
    const sendDigest = vi.fn().mockResolvedValue(undefined);
    const markSent = vi.fn().mockResolvedValue(undefined);

    const summary = await runWorkerCycle({
      leadStore: {
        createLeadIfNew: vi.fn().mockResolvedValue({ created: false }),
        listLeadRecords: vi.fn().mockResolvedValue([]),
        saveLeadReviewDraft: vi.fn().mockResolvedValue(null),
      },
      publishedDealStore: {
        getPublishedDealSlugForLead: vi.fn().mockResolvedValue(null),
        hasPublishedDealSlug: vi.fn().mockResolvedValue(false),
        publishDeal: vi.fn(),
      },
      sourceStore: {
        listEnabledSources: vi.fn().mockResolvedValue([]),
        recordSourcePoll: vi.fn().mockResolvedValue(undefined),
      },
      sourceFetcher: {
        fetch: vi.fn(),
      },
      digestDelivery: {
        subscriptionStore: {
          listEligibleSubscriptions: vi.fn().mockResolvedValue([
            {
              email: "shopper@example.com",
              locale: "en",
              frequency: "daily",
              categories: ["deals"],
              lastSentAt: null,
            },
          ]),
          markSent,
        },
        favoriteStore: {
          listByEmail: vi.fn().mockResolvedValue([{ dealId: "switch-en" }]),
        },
        dealStore: {
          listDigestDeals: vi.fn().mockResolvedValue([
            {
              id: "deal_switch",
              merchant: "Amazon AU",
              status: "published",
              category: "Deals",
              locales: {
                en: {
                  slug: "switch-en",
                  title: "Nintendo Switch OLED for A$399 at Amazon AU",
                  merchant: "Amazon AU",
                },
                zh: {
                  slug: "switch-zh",
                  title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
                  merchant: "亚马逊澳洲",
                },
              },
            },
          ]),
        },
        sender: {
          sendDigest,
        },
      },
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
    });

    expect(sendDigest).toHaveBeenCalledTimes(1);
    expect(markSent).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      digestSentCount: 1,
      skippedDigestCount: 0,
      digestSentEmails: ["shopper@example.com"],
    });
  });
});
