import { Router } from "express";

import type { AdminLeadStore, StoredLeadRecord, StoredLeadReviewDraft } from "./adminLeads.ts";
import type {
  PublishedDealPublisher,
  PublishedDealReader,
  PublishedDealSlugLookup,
} from "./publicDeals.ts";

type PublishingLocale = "en-AU" | "zh-CN";
type PublishingStatus = "scheduled" | "ready";

export interface PublishingQueueItem {
  id: string;
  leadId: string;
  deal: string;
  featuredSlot: string;
  publishAt: string;
  locale: PublishingLocale;
  status: PublishingStatus;
}

function getPublishingStatus(review: StoredLeadReviewDraft): PublishingStatus {
  return review.publish ? "scheduled" : "ready";
}

function buildPublishingQueueItem(
  record: StoredLeadRecord & { review: StoredLeadReviewDraft },
  locale: PublishingLocale,
): PublishingQueueItem {
  const { lead, review } = record;
  const title =
    locale === "en-AU"
      ? review.locales.en.title || lead.originalTitle || lead.id
      : review.locales.zh.title || lead.originalTitle || lead.id;

  return {
    id: `${lead.id}:${locale}`,
    leadId: lead.id,
    deal: title,
    featuredSlot: review.featuredSlot,
    publishAt: review.publishAt,
    locale,
    status: getPublishingStatus(review),
  };
}

export function buildPublishingQueueItems(
  records: StoredLeadRecord[],
): PublishingQueueItem[] {
  return records
    .flatMap((record) => {
      if (!record.review) {
        return [];
      }

      return [
        buildPublishingQueueItem(record as StoredLeadRecord & { review: StoredLeadReviewDraft }, "en-AU"),
        buildPublishingQueueItem(record as StoredLeadRecord & { review: StoredLeadReviewDraft }, "zh-CN"),
      ];
    })
    .sort((left, right) => {
      const publishAtDiff = Date.parse(left.publishAt) - Date.parse(right.publishAt);

      if (!Number.isNaN(publishAtDiff) && publishAtDiff !== 0) {
        return publishAtDiff;
      }

      return left.id.localeCompare(right.id);
    });
}

function slugifyTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function extractCurrentPrice(record: StoredLeadRecord & { review: StoredLeadReviewDraft }) {
  const text = [
    record.review.locales.en.title,
    record.review.locales.zh.title,
    record.lead.originalTitle,
    record.lead.snippet,
  ].join(" ");
  const match = text.match(/(?:A\$|\$)\s*(\d+(?:[.,]\d{1,2})?)/i);

  return match ? match[1].replace(",", "") : "0";
}

async function resolvePublishSlug(
  store: Partial<PublishedDealPublisher & PublishedDealReader & PublishedDealSlugLookup> | undefined,
  leadId: string,
  locale: string,
  title: string,
  reservedSlugs: Set<string>,
) {
  const baseSlug = slugifyTitle(title) || leadId.toLowerCase();
  const existingSlug = await store?.getPublishedDealSlugForLead?.(leadId, locale);

  if (existingSlug) {
    reservedSlugs.add(existingSlug);
    return existingSlug;
  }

  let candidate = baseSlug;
  let counter = 2;

  while (
    reservedSlugs.has(candidate) ||
    Boolean((await store?.hasPublishedDealSlug?.(candidate)) ?? false)
  ) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  reservedSlugs.add(candidate);
  return candidate;
}

async function buildPublishPayload(
  record: StoredLeadRecord & { review: StoredLeadReviewDraft },
  store?: Partial<PublishedDealPublisher & PublishedDealReader & PublishedDealSlugLookup>,
) {
  const englishTitle = record.review.locales.en.title || record.lead.originalTitle || record.lead.id;
  const chineseTitle = record.review.locales.zh.title || record.lead.originalTitle || record.lead.id;
  const reservedSlugs = new Set<string>();
  const englishSlug = await resolvePublishSlug(
    store,
    record.lead.id,
    "en",
    englishTitle,
    reservedSlugs,
  );
  const chineseSlug = await resolvePublishSlug(
    store,
    record.lead.id,
    "zh",
    chineseTitle,
    reservedSlugs,
  );

  return {
    leadId: record.lead.id,
    merchant: record.lead.sourceId,
    category: record.review.category,
    currentPrice: extractCurrentPrice(record),
    affiliateUrl: record.lead.originalUrl,
    locales: [
      {
        locale: "en",
        slug: englishSlug,
        title: englishTitle,
        summary: record.review.locales.en.summary,
      },
      {
        locale: "zh",
        slug: chineseSlug,
        title: chineseTitle,
        summary: record.review.locales.zh.summary,
      },
    ],
  };
}

export function createAdminPublishingRouter(
  store: Pick<AdminLeadStore, "listLeadRecords" | "getLeadRecord" | "saveLeadReviewDraft">,
  publishedDealStore?: Partial<PublishedDealPublisher & PublishedDealReader & PublishedDealSlugLookup>,
) {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json({
      items: buildPublishingQueueItems(await store.listLeadRecords()),
    });
  });

  router.post("/:leadId/publish", async (request, response) => {
    if (!publishedDealStore?.publishDeal) {
      response.status(503).json({ message: "Publishing store is not configured." });
      return;
    }

    const record = await store.getLeadRecord(request.params.leadId ?? "");

    if (!record) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    if (!record.review) {
      response.status(400).json({ message: "Review draft is required before publishing." });
      return;
    }

    const review = record.review as StoredLeadReviewDraft;
    const result = await publishedDealStore.publishDeal(
      await buildPublishPayload(record as StoredLeadRecord & { review: StoredLeadReviewDraft }, publishedDealStore),
    );
    await store.saveLeadReviewDraft({
      ...review,
      publish: true,
    });

    response.json(result);
  });

  return router;
}
