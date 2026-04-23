import { Router } from "express";
import { reviewLead, type LeadReview } from "@aussie-deal-hub/ai/reviewLead";

export interface LeadRecord {
  id: string;
  sourceId: string;
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

export type LeadReviewStore = Map<string, StoredLeadReviewDraft>;

export type LeadQueueStatus = "pending_review" | "draft_saved" | "queued_to_publish";

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
    typeof candidate.confidence === "number" &&
    Number.isFinite(candidate.confidence) &&
    isStringArray(candidate.riskLabels) &&
    isStringArray(candidate.tags) &&
    isString(candidate.featuredSlot) &&
    isString(candidate.publishAt) &&
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

export function reviewStoredLead(
  store: Map<string, LeadRecord>,
  leadId: string,
): LeadReview | undefined {
  const lead = store.get(leadId);

  if (!lead) {
    return undefined;
  }

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

function getLeadQueueStatus(review?: StoredLeadReviewDraft): LeadQueueStatus {
  if (!review) {
    return "pending_review";
  }

  return review.publish ? "queued_to_publish" : "draft_saved";
}

function getLeadQueueLabel(status: LeadQueueStatus) {
  switch (status) {
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

function buildLeadListItem(
  lead: LeadRecord,
  review?: StoredLeadReviewDraft,
): LeadListItem {
  const status = getLeadQueueStatus(review);

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
  store: Map<string, LeadRecord>,
  reviewStore: LeadReviewStore,
) {
  const router = Router();

  router.get("/leads", (_request, response) => {
    response.json({
      items: Array.from(store.values()).map((lead) =>
        buildLeadListItem(lead, reviewStore.get(lead.id)),
      ),
    });
  });

  router.get("/leads/:leadId", (request, response) => {
    const leadId = request.params.leadId ?? "";
    const lead = store.get(leadId);

    if (!lead) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    const review = reviewStore.get(leadId);

    response.json(review ? { ...lead, review } : lead);
  });

  router.post("/leads", (request, response) => {
    const input = request.body as CreateLeadInput | undefined;

    if (!isCreateLeadInput(input)) {
      response.status(400).json({ message: "Lead payload is invalid." });
      return;
    }

    response.status(201).json(createLead(store, input));
  });

  router.post("/leads/:leadId/review", (request, response) => {
    const review = reviewStoredLead(store, request.params.leadId ?? "");

    if (!review) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    response.json(review);
  });

  router.put("/leads/:leadId/review", (request, response) => {
    const leadId = request.params.leadId ?? "";
    const lead = store.get(leadId);
    const input = request.body as LeadReviewDraftSubmission | undefined;

    if (!lead) {
      response.status(404).json({ message: "Lead not found." });
      return;
    }

    if (!isLeadReviewDraftSubmission(input)) {
      response.status(400).json({ message: "Review draft payload is invalid." });
      return;
    }

    if (input.leadId !== leadId) {
      response.status(400).json({ message: "Review draft lead ID does not match the route." });
      return;
    }

    response.json(saveLeadReviewDraft(reviewStore, input));
  });

  return router;
}
