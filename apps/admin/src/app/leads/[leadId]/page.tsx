"use client";

import React, { useEffect, useState } from "react";

import LeadReviewForm, {
  type LeadReviewDraft,
  type LeadReviewSubmission,
} from "../../../components/LeadReviewForm";

interface LeadLocaleMetadata {
  title: string;
  summary: string;
}

interface LeadDetailRecord {
  id: string;
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  createdAt: string;
  review: LeadReviewDraft;
}

interface LeadDetailLoadResult {
  lead: LeadDetailRecord | null;
  error: string | null;
}

interface LeadDetailPageProps {
  params: Promise<{
    leadId: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeLocaleMetadata(
  value: unknown,
  fallbackTitle: string,
  fallbackSummary: string,
): LeadLocaleMetadata {
  if (!isRecord(value)) {
    return {
      title: fallbackTitle,
      summary: fallbackSummary,
    };
  }

  return {
    title: readString(value.title) || fallbackTitle,
    summary: readString(value.summary) || fallbackSummary,
  };
}

function buildLeadReviewDraft(
  reviewValue: unknown,
  fallbackTitle: string,
  fallbackSummary: string,
  fallbackPublishAt: string,
): LeadReviewDraft {
  const review = isRecord(reviewValue) ? reviewValue : {};
  const locales = isRecord(review.locales) ? review.locales : {};

  return {
    category: readString(review.category) || "Uncategorized",
    confidence: readNumber(review.confidence),
    riskLabels: readStringArray(review.riskLabels),
    tags: readStringArray(review.tags),
    featuredSlot: readString(review.featuredSlot),
    publishAt: readString(review.publishAt) || fallbackPublishAt,
    locales: {
      en: normalizeLocaleMetadata(locales.en, fallbackTitle, fallbackSummary),
      zh: normalizeLocaleMetadata(locales.zh, "", ""),
    },
  };
}

function normalizeLeadDetail(body: unknown): LeadDetailRecord | null {
  if (!isRecord(body)) {
    return null;
  }

  const lead = isRecord(body.lead) ? body.lead : body;
  const review = isRecord(body.review) ? body.review : lead.review;
  const id = readString(lead.id);

  if (!id) {
    return null;
  }

  const originalTitle = readString(lead.originalTitle);
  const snippet = readString(lead.snippet);
  const createdAt = readString(lead.createdAt);

  return {
    id,
    sourceId: readString(lead.sourceId),
    originalTitle,
    originalUrl: readString(lead.originalUrl),
    snippet,
    createdAt,
    review: buildLeadReviewDraft(review, originalTitle, snippet, createdAt),
  };
}

async function loadLeadDetail(leadId: string): Promise<LeadDetailLoadResult> {
  try {
    const response = await fetch(`/v1/admin/leads/${leadId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        lead: null,
        error: "Failed to load lead.",
      };
    }

    const lead = normalizeLeadDetail(await response.json());

    if (!lead) {
      return {
        lead: null,
        error: "Failed to load lead.",
      };
    }

    return {
      lead,
      error: null,
    };
  } catch {
    return {
      lead: null,
      error: "Failed to load lead.",
    };
  }
}

async function submitLeadReview(submission: LeadReviewSubmission) {
  try {
    const response = await fetch(`/v1/admin/leads/${submission.leadId}/review`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      return {
        error: "Failed to submit review.",
      };
    }

    return {
      error: null,
    };
  } catch {
    return {
      error: "Failed to submit review.",
    };
  }
}

async function publishLeadReview(submission: LeadReviewSubmission) {
  try {
    const response = await fetch(`/v1/admin/publishing/${submission.leadId}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      return {
        error: "Failed to publish deal.",
      };
    }

    return {
      error: null,
    };
  } catch {
    return {
      error: "Failed to publish deal.",
    };
  }
}

async function resolveLeadId(params: LeadDetailPageProps["params"]) {
  const resolvedParams = await params;
  return resolvedParams.leadId;
}

export default function LeadDetailPage({ params }: LeadDetailPageProps) {
  const [leadId, setLeadId] = useState("");
  const [lead, setLead] = useState<LeadDetailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setIsLoading(true);
      setFeedback(null);

      const resolvedLeadId = await resolveLeadId(params);

      if (cancelled) {
        return;
      }

      setLeadId(resolvedLeadId);

      const result = await loadLeadDetail(resolvedLeadId);

      if (cancelled) {
        return;
      }

      setLead(result.lead);
      setError(result.error);
      setIsLoading(false);
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [params]);

  async function handleSubmit(submission: LeadReviewSubmission) {
    setFeedback(null);

    if (!submission.publish) {
      const result = await submitLeadReview(submission);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback("Draft saved.");
      return;
    }

    const draftSubmission = {
      ...submission,
      publish: false,
    };
    const draftResult = await submitLeadReview(draftSubmission);

    if (draftResult.error) {
      setFeedback("Failed to save review before publishing.");
      return;
    }

    const publishResult = await publishLeadReview(submission);

    if (publishResult.error) {
      setFeedback("Draft saved, but failed to queue deal for publishing.");
      return;
    }

    setFeedback("Deal queued for publishing.");
  }

  return (
    <main>
      <h1>Lead {leadId}</h1>
      <p>Edit bilingual deal content and publish when it is ready.</p>
      {feedback ? <p aria-live="polite">{feedback}</p> : null}
      {error ? (
        <p>{error}</p>
      ) : isLoading ? (
        <p>Loading lead.</p>
      ) : !lead ? (
        <p>Lead not found.</p>
      ) : (
        <>
          <section>
            <h2>Lead metadata</h2>
            <dl>
              <dt>Source ID</dt>
              <dd>{lead.sourceId || "Unknown"}</dd>
              <dt>Original title</dt>
              <dd>{lead.originalTitle || "Untitled lead"}</dd>
              <dt>Original URL</dt>
              <dd>
                {lead.originalUrl ? (
                  <a href={lead.originalUrl}>{lead.originalUrl}</a>
                ) : (
                  "No URL"
                )}
              </dd>
              <dt>Snippet</dt>
              <dd>{lead.snippet || "No snippet"}</dd>
              <dt>Created at</dt>
              <dd>{lead.createdAt || "Unknown"}</dd>
            </dl>
          </section>

          <LeadReviewForm
            initialReview={lead.review}
            leadId={lead.id}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </main>
  );
}
