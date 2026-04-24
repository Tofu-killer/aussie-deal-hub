import {
  createAdminLeadRepository,
} from "@aussie-deal-hub/db/repositories/leads";
import { createPublishedDealRepository } from "@aussie-deal-hub/db/repositories/deals";

import { publishDueReviews, type WorkerLeadRecord } from "./jobs/publishDueReviews";
import { reviewPendingLeads, type ReviewedLeadRecord } from "./jobs/reviewPendingLeads";

type AdminLeadRepository = ReturnType<typeof createAdminLeadRepository>;
type PublishedDealRepository = ReturnType<typeof createPublishedDealRepository>;
type StoredLeadRecord = Awaited<ReturnType<AdminLeadRepository["listLeadRecords"]>>[number];

export interface WorkerCycleSummary {
  publishedCount: number;
  publishedLeadIds: string[];
  queuedPublishCount: number;
  queuedReviewCount: number;
  reviewedCount: number;
  reviewedLeadIds: string[];
  skippedPublishCount: number;
}

export interface WorkerRuntimeDependencies {
  leadStore: Pick<AdminLeadRepository, "listLeadRecords" | "saveLeadReviewDraft">;
  publishedDealStore: Pick<
    PublishedDealRepository,
    "getPublishedDealSlugForLead" | "hasPublishedDealSlug" | "publishDeal"
  >;
  log: Pick<Console, "error" | "info">;
}

function createTimestampedLogPrefix() {
  return `[worker ${new Date().toISOString()}]`;
}

export function getDefaultFeaturedSlot(category: ReviewedLeadRecord["category"]) {
  switch (category) {
    case "Historical Lows":
      return "historical-lows";
    case "Freebies":
      return "freebies";
    case "Gift Card Offers":
      return "gift-card-offers";
    default:
      return "hero";
  }
}

export function buildAutoReviewDraft(reviewedLead: ReviewedLeadRecord) {
  return {
    leadId: reviewedLead.id,
    category: reviewedLead.category,
    confidence: reviewedLead.aiConfidence,
    riskLabels: reviewedLead.riskLabels,
    tags: [],
    featuredSlot: getDefaultFeaturedSlot(reviewedLead.category),
    publishAt: reviewedLead.reviewedAt,
    locales: reviewedLead.locales,
    publish: false,
  };
}

export function buildWorkerLeadRecords(records: StoredLeadRecord[]): WorkerLeadRecord[] {
  return records.map((record) => ({
    lead: {
      id: record.lead.id,
      sourceId: record.lead.sourceId,
      sourceName: record.lead.sourceName,
      originalTitle: record.lead.originalTitle,
      originalUrl: record.lead.originalUrl,
      snippet: record.lead.snippet,
      createdAt: record.lead.createdAt,
    },
    review: record.review
      ? {
          leadId: record.review.leadId,
          category: record.review.category,
          confidence: record.review.confidence,
          riskLabels: record.review.riskLabels,
          tags: record.review.tags,
          featuredSlot: record.review.featuredSlot,
          publishAt: record.review.publishAt,
          locales: record.review.locales,
          publish: record.review.publish,
          updatedAt: record.review.updatedAt,
        }
      : null,
  }));
}

export async function runWorkerCycle({
  leadStore,
  publishedDealStore,
  log,
}: WorkerRuntimeDependencies): Promise<WorkerCycleSummary> {
  const records = await leadStore.listLeadRecords();
  const pendingLeads = records
    .filter((record) => record.review === null)
    .map((record) => ({
      id: record.lead.id,
      originalTitle: record.lead.originalTitle,
      snippet: record.lead.snippet,
      reviewStatus: "pending",
    }));
  const reviewedLeads = reviewPendingLeads(pendingLeads);

  for (const reviewedLead of reviewedLeads) {
    await leadStore.saveLeadReviewDraft(buildAutoReviewDraft(reviewedLead));
  }

  const postReviewRecords = reviewedLeads.length > 0 ? await leadStore.listLeadRecords() : records;
  const workerLeadRecords = buildWorkerLeadRecords(postReviewRecords);
  const publishSummary = await publishDueReviews(workerLeadRecords, publishedDealStore, {
    now: new Date(),
  });

  const summary: WorkerCycleSummary = {
    reviewedCount: reviewedLeads.length,
    reviewedLeadIds: reviewedLeads.map((lead) => lead.id),
    queuedReviewCount: pendingLeads.length,
    queuedPublishCount: workerLeadRecords.filter((record) => record.review?.publish).length,
    publishedCount: publishSummary.published.length,
    publishedLeadIds: publishSummary.published.map((item) => item.leadId),
    skippedPublishCount: publishSummary.skipped.length,
  };

  log.info(
    `${createTimestampedLogPrefix()} review=${summary.reviewedCount}/${summary.queuedReviewCount} publish=${summary.publishedCount}/${summary.queuedPublishCount} skipped=${summary.skippedPublishCount}`,
  );

  if (summary.reviewedLeadIds.length > 0) {
    log.info(
      `${createTimestampedLogPrefix()} reviewed leads: ${summary.reviewedLeadIds.join(", ")}`,
    );
  }

  if (summary.publishedLeadIds.length > 0) {
    log.info(
      `${createTimestampedLogPrefix()} published leads: ${summary.publishedLeadIds.join(", ")}`,
    );
  }

  return summary;
}
