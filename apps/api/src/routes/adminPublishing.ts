import { Router } from "express";

import type { AdminLeadStore, StoredLeadRecord, StoredLeadReviewDraft } from "./adminLeads.ts";

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

export function createAdminPublishingRouter(
  store: Pick<AdminLeadStore, "listLeadRecords">,
) {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json({
      items: buildPublishingQueueItems(await store.listLeadRecords()),
    });
  });

  return router;
}
