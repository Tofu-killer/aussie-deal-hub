import { Router } from "express";

import type { LeadRecord, LeadReviewStore, StoredLeadReviewDraft } from "./adminLeads.ts";

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
  lead: LeadRecord,
  review: StoredLeadReviewDraft,
  locale: PublishingLocale,
): PublishingQueueItem {
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
  leadStore: Map<string, LeadRecord>,
  reviewStore: LeadReviewStore,
): PublishingQueueItem[] {
  return Array.from(reviewStore.values())
    .flatMap((review) => {
      const lead = leadStore.get(review.leadId);

      if (!lead) {
        return [];
      }

      return [
        buildPublishingQueueItem(lead, review, "en-AU"),
        buildPublishingQueueItem(lead, review, "zh-CN"),
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
  leadStore: Map<string, LeadRecord>,
  reviewStore: LeadReviewStore,
) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({
      items: buildPublishingQueueItems(leadStore, reviewStore),
    });
  });

  return router;
}
