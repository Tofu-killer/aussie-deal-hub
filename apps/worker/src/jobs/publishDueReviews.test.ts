import { describe, expect, it } from "vitest";

import {
  publishDueReviews,
  type PublishDealInput,
  type WorkerLeadRecord,
} from "./publishDueReviews";

function createRecord(
  id: string,
  review: WorkerLeadRecord["review"],
): WorkerLeadRecord {
  return {
    lead: {
      id,
      sourceId: `merchant_${id}`,
      originalTitle: `${id} original title A$10`,
      originalUrl: `https://deals.test/${id}`,
      snippet: `${id} snippet`,
      createdAt: "2026-04-22T00:00:00.000Z",
    },
    review,
  };
}

function createReview(
  overrides: Partial<NonNullable<WorkerLeadRecord["review"]>> = {},
): NonNullable<WorkerLeadRecord["review"]> {
  return {
    leadId: "lead_default",
    category: "Deals",
    confidence: 90,
    riskLabels: [],
    tags: ["tested"],
    featuredSlot: "homepage",
    publishAt: "2026-04-23T09:00:00.000Z",
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
    updatedAt: "2026-04-22T08:00:00.000Z",
    ...overrides,
  };
}

describe("publishDueReviews", () => {
  it("publishes due queued reviews and records skip reasons for ineligible leads", async () => {
    const publishedInputs: PublishDealInput[] = [];
    const publisher = {
      async publishDeal(input: PublishDealInput) {
        publishedInputs.push(input);

        return {
          leadId: input.leadId,
          status: "published",
          locales: input.locales.map((locale) => ({
            locale: locale.locale,
            slug: locale.slug,
          })),
        };
      },
    };

    const summary = await publishDueReviews(
      [
        createRecord("lead_due", createReview({ leadId: "lead_due" })),
        createRecord(
          "lead_future",
          createReview({
            leadId: "lead_future",
            publishAt: "2026-04-24T09:00:00.000Z",
          }),
        ),
        createRecord(
          "lead_not_queued",
          createReview({
            leadId: "lead_not_queued",
            publish: false,
          }),
        ),
        createRecord(
          "lead_invalid_publish_at",
          createReview({
            leadId: "lead_invalid_publish_at",
            publishAt: "tomorrow morning maybe",
          }),
        ),
        createRecord("lead_missing_review", null),
      ],
      publisher,
      {
        now: "2026-04-23T10:00:00.000Z",
      },
    );

    expect(publishedInputs).toEqual([
      {
        leadId: "lead_due",
        merchant: "merchant_lead_due",
        category: "Deals",
        currentPrice: "59",
        affiliateUrl: "https://deals.test/lead_due",
        locales: [
          {
            locale: "en",
            slug: "lego-bonsai-tree-for-a-59-at-big-w",
            title: "LEGO Bonsai Tree for A$59 at Big W",
            summary: "Weekend sale drops the LEGO display set to A$59.",
          },
          {
            locale: "zh",
            slug: "big-w-乐高盆景树套装-a-59",
            title: "Big W 乐高盆景树套装 A$59",
            summary: "周末玩具促销，展示款乐高套装降至 A$59。",
          },
        ],
      },
    ]);
    expect(summary).toEqual({
      published: [
        {
          leadId: "lead_due",
          publishAt: "2026-04-23T09:00:00.000Z",
          result: {
            leadId: "lead_due",
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
          },
        },
      ],
      skipped: [
        {
          leadId: "lead_future",
          reason: "future_publish_at",
          publishAt: "2026-04-24T09:00:00.000Z",
        },
        {
          leadId: "lead_not_queued",
          reason: "not_queued",
          publishAt: "2026-04-23T09:00:00.000Z",
        },
        {
          leadId: "lead_invalid_publish_at",
          reason: "invalid_publish_at",
          publishAt: "tomorrow morning maybe",
        },
        {
          leadId: "lead_missing_review",
          reason: "missing_review",
        },
      ],
    });
  });

  it("deduplicates colliding published slugs before calling the publisher", async () => {
    const publishedDeals = new Map<
      string,
      {
        leadId: string;
        locale: string;
        slug: string;
      }
    >();
    const publisher = {
      async publishDeal(input: PublishDealInput) {
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
      async hasPublishedDealSlug(slug: string) {
        return Array.from(publishedDeals.values()).some((deal) => deal.slug === slug);
      },
    };

    const summary = await publishDueReviews(
      [
        createRecord(
          "lead_1",
          createReview({
            leadId: "lead_1",
            category: "Kitchen",
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
          }),
        ),
        createRecord(
          "lead_2",
          createReview({
            leadId: "lead_2",
            category: "Kitchen",
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
          }),
        ),
      ],
      publisher,
      {
        now: "2026-04-23T10:00:00.000Z",
      },
    );

    expect(summary.published.map((item) => item.result)).toEqual([
      {
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
      },
      {
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
      },
    ]);
  });

  it("reuses existing slugs when rerunning the same lead", async () => {
    const publishedDeals = new Map<
      string,
      {
        leadId: string;
        locale: string;
        slug: string;
      }
    >();
    const publisher = {
      async publishDeal(input: PublishDealInput) {
        for (const locale of input.locales) {
          const duplicate = Array.from(publishedDeals.values()).find(
            (deal) => deal.slug === locale.slug && deal.leadId !== input.leadId,
          );

          if (duplicate) {
            throw new Error(`Duplicate slug: ${locale.slug}`);
          }
        }

        for (const locale of input.locales) {
          publishedDeals.set(`${input.leadId}:${locale.locale}`, {
            leadId: input.leadId,
            locale: locale.locale,
            slug: locale.slug,
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
      async hasPublishedDealSlug(slug: string) {
        return Array.from(publishedDeals.values()).some((deal) => deal.slug === slug);
      },
      async getPublishedDealSlugForLead(leadId: string, locale: string) {
        return publishedDeals.get(`${leadId}:${locale}`)?.slug ?? null;
      },
    };
    const records = [
      createRecord(
        "lead_repeat",
        createReview({
          leadId: "lead_repeat",
          locales: {
            en: {
              title: "Coffee Grinder for A$49 at Kmart",
              summary: "Entry-level grinder deal.",
            },
            zh: {
              title: "Kmart 咖啡研磨机 A$49",
              summary: "入门款咖啡研磨机促销。",
            },
          },
        }),
      ),
    ];

    const firstRun = await publishDueReviews(records, publisher, {
      now: "2026-04-23T10:00:00.000Z",
    });
    const secondRun = await publishDueReviews(records, publisher, {
      now: "2026-04-23T10:00:00.000Z",
    });

    expect(firstRun.published[0]?.result.locales).toEqual([
      {
        locale: "en",
        slug: "coffee-grinder-for-a-49-at-kmart",
      },
      {
        locale: "zh",
        slug: "kmart-咖啡研磨机-a-49",
      },
    ]);
    expect(secondRun.published[0]?.result.locales).toEqual(firstRun.published[0]?.result.locales);
  });
});
