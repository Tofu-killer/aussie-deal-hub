import { Router } from "express";
import { reviewLead, type LeadReview } from "@aussie-deal-hub/ai/reviewLead";
import type { PublishedDealSlugLookup } from "./publicDeals.ts";

export interface LeadRecord {
  id: string;
  sourceId: string;
  sourceName?: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  createdAt: string;
}

export interface CreateLeadInput {
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
}

export interface LeadReviewLocaleDraft {
  title: string;
  summary: string;
}

export interface LeadReviewDraftSubmission {
  leadId: string;
  category: string;
  confidence: number;
  riskLabels: string[];
  tags: string[];
  featuredSlot: string;
  publishAt: string;
  locales: {
    en: LeadReviewLocaleDraft;
    zh: LeadReviewLocaleDraft;
  };
  publish: boolean;
}

export interface StoredLeadReviewDraft extends LeadReviewDraftSubmission {
  updatedAt: string;
}

export interface StoredLeadRecord {
  lead: LeadRecord;
  review: StoredLeadReviewDraft | null;
}

export interface AdminLeadStore {
  listLeadRecords(): Promise<StoredLeadRecord[]>;
  getLeadRecord(leadId: string): Promise<StoredLeadRecord | null>;
  createLead(input: CreateLeadInput): Promise<LeadRecord>;
  saveLeadReviewDraft(input: LeadReviewDraftSubmission): Promise<StoredLeadReviewDraft | null>;
}

export type LeadReviewStore = Map<string, StoredLeadReviewDraft>;

export type LeadQueueStatus = "pending_review" | "draft_saved" | "queued_to_publish" | "published";

export interface LeadQueueSummary {
  status: LeadQueueStatus;
  label: string;
}

export interface LeadListReviewSummary {
  leadId: string;
  category: string;
  confidence: number;
  riskLabels: string[];
  tags: string[];
  featuredSlot: string;
  publishAt: string;
  publish: boolean;
  updatedAt: string;
}

export interface LeadListItem extends LeadRecord {
  queue: LeadQueueSummary;
  review?: LeadListReviewSummary;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isParseableDateTimeString(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isLeadReviewLocaleDraft(value: unknown): value is LeadReviewLocaleDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return isString(candidate.title) && isString(candidate.summary);
}

export function isCreateLeadInput(value: unknown): value is CreateLeadInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.sourceId) &&
    isNonEmptyString(candidate.originalTitle) &&
    isNonEmptyString(candidate.originalUrl) &&
    isNonEmptyString(candidate.snippet)
  );
}

export function isLeadReviewDraftSubmission(value: unknown): value is LeadReviewDraftSubmission {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const locales =
    candidate.locales && typeof candidate.locales === "object"
      ? (candidate.locales as Record<string, unknown>)
      : null;

  return (
    isNonEmptyString(candidate.leadId) &&
    isString(candidate.category) &&
    isInteger(candidate.confidence) &&
    isStringArray(candidate.riskLabels) &&
    isStringArray(candidate.tags) &&
    isString(candidate.featuredSlot) &&
    isParseableDateTimeString(candidate.publishAt) &&
    Boolean(locales) &&
    isLeadReviewLocaleDraft(locales?.en) &&
    isLeadReviewLocaleDraft(locales?.zh) &&
    typeof candidate.publish === "boolean"
  );
}

export function createLead(
  store: Map<string, LeadRecord>,
  input: CreateLeadInput,
): LeadRecord {
  const id = `lead_${store.size + 1}`;
  const lead: LeadRecord = {
    id,
    sourceId: input.sourceId,
    originalTitle: input.originalTitle,
    originalUrl: input.originalUrl,
    snippet: input.snippet,
    createdAt: new Date().toISOString(),
  };

  store.set(id, lead);

  return lead;
}

export function reviewStoredLead(lead: LeadRecord): LeadReview {
  return reviewLead(lead);
}

export function saveLeadReviewDraft(
  store: LeadReviewStore,
  input: LeadReviewDraftSubmission,
): StoredLeadReviewDraft {
  const reviewDraft: StoredLeadReviewDraft = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  store.set(input.leadId, reviewDraft);

  return reviewDraft;
}

async function getLeadQueueStatus(
  leadId: string,
  review?: StoredLeadReviewDraft | null,
  publishedDealStore?: Partial<PublishedDealSlugLookup>,
): Promise<LeadQueueStatus> {
  const publishedSlug = await publishedDealStore?.getPublishedDealSlugForLead?.(leadId, "en");
  if (publishedSlug) {
    return "published";
  }

  if (!review) {
    return "pending_review";
  }

  return review.publish ? "queued_to_publish" : "draft_saved";
}

function getLeadQueueLabel(status: LeadQueueStatus) {
  switch (status) {
    case "published":
      return "Published";
    case "draft_saved":
      return "Draft saved";
    case "queued_to_publish":
      return "Queued to publish";
    default:
      return "Pending review";
  }
}

function summarizeLeadReview(review: StoredLeadReviewDraft): LeadListReviewSummary {
  return {
    leadId: review.leadId,
    category: review.category,
    confidence: review.confidence,
    riskLabels: review.riskLabels,
    tags: review.tags,
    featuredSlot: review.featuredSlot,
    publishAt: review.publishAt,
    publish: review.publish,
    updatedAt: review.updatedAt,
  };
}

async function buildLeadListItem(
  record: StoredLeadRecord,
  publishedDealStore?: Partial<PublishedDealSlugLookup>,
): Promise<LeadListItem> {
  const { lead, review } = record;
  const status = await getLeadQueueStatus(lead.id, review, publishedDealStore);

  return review
    ? {
        ...lead,
        queue: {
          status,
          label: getLeadQueueLabel(status),
        },
        review: summarizeLeadReview(review),
      }
    : {
        ...lead,
        queue: {
          status,
          label: getLeadQueueLabel(status),
        },
      };
}

export function createAdminLeadsRouter(
  store: AdminLeadStore,
  publishedDealStore?: Partial<PublishedDealSlugLookup>,
) {
  const router = Router();

  router.get("/leads", async (_request, response) => {
    response.json({
      items: await Promise.all(
        (await store.listLeadRecords()).map((record) =>
          buildLeadListItem(record, publishedDealStore),
        ),
      ),
    });
  });

  router.get("/leads/:leadId", async (request, response) => {
    const leadId = request.params.leadId ?? "";
    const record = await store.getLeadRecord(leadId);

    if (!record) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    response.json({
      ...record.lead,
      review: record.review ?? reviewStoredLead(record.lead),
    });
  });

  router.post("/leads", async (request, response) => {
    const input = request.body as CreateLeadInput | undefined;

    if (!isCreateLeadInput(input)) {
      response.status(400).json({ message: "Lead payload is invalid." });
      return;
    }

    response.status(201).json(await store.createLead(input));
  });

  router.post("/leads/:leadId/review", async (request, response) => {
    const record = await store.getLeadRecord(request.params.leadId ?? "");

    if (!record) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    response.json(reviewStoredLead(record.lead));
  });

  router.put("/leads/:leadId/review", async (request, response) => {
    const leadId = request.params.leadId ?? "";
    const input = request.body as LeadReviewDraftSubmission | undefined;

    if (!isLeadReviewDraftSubmission(input)) {
      response.status(400).json({ message: "Review draft payload is invalid." });
      return;
    }

    if (input.leadId !== leadId) {
      response.status(400).json({ message: "Review draft lead ID does not match the route." });
      return;
    }

    const review = await store.saveLeadReviewDraft(input);

    if (!review) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    response.json(review);
  });

  return router;
}
