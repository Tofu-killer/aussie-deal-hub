export interface WorkerLeadRecord {
  lead: {
    id: string;
    sourceId: string;
    sourceName?: string;
    originalTitle: string;
    originalUrl: string;
    snippet: string;
    createdAt?: string;
  };
  review: {
    leadId: string;
    category: string;
    confidence: number;
    riskLabels: string[];
    tags: string[];
    featuredSlot: string;
    publishAt: string;
    locales: {
      en: {
        title: string;
        summary: string;
      };
      zh: {
        title: string;
        summary: string;
      };
    };
    publish: boolean;
    updatedAt?: string;
  } | null;
}

export interface PublishDealLocaleInput {
  locale: string;
  slug: string;
  title: string;
  summary: string;
}

export interface PublishDealInput {
  leadId: string;
  merchant: string;
  category: string;
  currentPrice: string;
  affiliateUrl: string;
  locales: PublishDealLocaleInput[];
}

export interface PublishDealResult {
  leadId: string;
  status: string;
  locales: Array<{
    locale: string;
    slug: string;
  }>;
}

export interface PublishedDealPublisher {
  publishDeal(input: PublishDealInput): Promise<PublishDealResult>;
  hasPublishedDealSlug?(slug: string): Promise<boolean>;
  getPublishedDealSlugForLead?(leadId: string, locale: string): Promise<string | null>;
}

export type PublishDueReviewsSkipReason =
  | "missing_review"
  | "not_queued"
  | "future_publish_at"
  | "invalid_publish_at";

export interface PublishDueReviewsSkippedItem {
  leadId: string;
  reason: PublishDueReviewsSkipReason;
  publishAt?: string;
}

export interface PublishDueReviewsPublishedItem {
  leadId: string;
  publishAt: string;
  result: PublishDealResult;
}

export interface PublishDueReviewsSummary {
  published: PublishDueReviewsPublishedItem[];
  skipped: PublishDueReviewsSkippedItem[];
}

export interface PublishDueReviewsOptions {
  now?: string | Date;
}

type WorkerLeadRecordWithReview = WorkerLeadRecord & {
  review: NonNullable<WorkerLeadRecord["review"]>;
};

function slugifyTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function extractCurrentPrice(record: WorkerLeadRecordWithReview) {
  const text = [
    record.review.locales.en.title,
    record.review.locales.zh.title,
    record.lead.originalTitle,
    record.lead.snippet,
  ].join(" ");
  const match = text.match(/(?:A\$|\$)\s*(\d+(?:[.,]\d{1,2})?)/i);

  return match ? match[1].replace(",", "") : "0";
}

function resolveNow(options: PublishDueReviewsOptions) {
  return options.now instanceof Date
    ? options.now.getTime()
    : Date.parse(options.now ?? new Date().toISOString());
}

async function resolvePublishSlug(
  publisher: PublishedDealPublisher,
  leadId: string,
  locale: string,
  title: string,
  reservedSlugs: Set<string>,
) {
  const baseSlug = slugifyTitle(title) || leadId.toLowerCase();
  const existingSlug = await publisher.getPublishedDealSlugForLead?.(leadId, locale);

  if (existingSlug) {
    reservedSlugs.add(existingSlug);
    return existingSlug;
  }

  let candidate = baseSlug;
  let counter = 2;

  while (
    reservedSlugs.has(candidate) ||
    Boolean((await publisher.hasPublishedDealSlug?.(candidate)) ?? false)
  ) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  reservedSlugs.add(candidate);
  return candidate;
}

async function buildPublishPayload(
  record: WorkerLeadRecordWithReview,
  publisher: PublishedDealPublisher,
  reservedSlugs: Set<string>,
): Promise<PublishDealInput> {
  const englishTitle = record.review.locales.en.title || record.lead.originalTitle || record.lead.id;
  const chineseTitle = record.review.locales.zh.title || record.lead.originalTitle || record.lead.id;
  const englishSlug = await resolvePublishSlug(
    publisher,
    record.lead.id,
    "en",
    englishTitle,
    reservedSlugs,
  );
  const chineseSlug = await resolvePublishSlug(
    publisher,
    record.lead.id,
    "zh",
    chineseTitle,
    reservedSlugs,
  );

  return {
    leadId: record.lead.id,
    merchant: record.lead.sourceName ?? record.lead.sourceId,
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

export async function publishDueReviews(
  records: WorkerLeadRecord[],
  publisher: PublishedDealPublisher,
  options: PublishDueReviewsOptions = {},
): Promise<PublishDueReviewsSummary> {
  const now = resolveNow(options);
  const summary: PublishDueReviewsSummary = {
    published: [],
    skipped: [],
  };
  const reservedSlugs = new Set<string>();

  for (const record of records) {
    if (!record.review) {
      summary.skipped.push({
        leadId: record.lead.id,
        reason: "missing_review",
      });
      continue;
    }

    if (!record.review.publish) {
      summary.skipped.push({
        leadId: record.lead.id,
        reason: "not_queued",
        publishAt: record.review.publishAt,
      });
      continue;
    }

    const publishAt = Date.parse(record.review.publishAt);

    if (Number.isNaN(publishAt)) {
      summary.skipped.push({
        leadId: record.lead.id,
        reason: "invalid_publish_at",
        publishAt: record.review.publishAt,
      });
      continue;
    }

    if (publishAt > now) {
      summary.skipped.push({
        leadId: record.lead.id,
        reason: "future_publish_at",
        publishAt: record.review.publishAt,
      });
      continue;
    }

    const result = await publisher.publishDeal(
      await buildPublishPayload(record as WorkerLeadRecordWithReview, publisher, reservedSlugs),
    );
    summary.published.push({
      leadId: record.lead.id,
      publishAt: record.review.publishAt,
      result,
    });
  }

  return summary;
}
