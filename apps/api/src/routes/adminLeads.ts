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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

export function createAdminLeadsRouter(store: Map<string, LeadRecord>) {
  const router = Router();

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

  return router;
}
