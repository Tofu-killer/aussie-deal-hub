"use client";

import React, { useEffect, useState } from "react";

import LeadReviewForm, {
  type LeadReviewDraft,
  type LeadReviewSubmission,
} from "../../../components/LeadReviewForm";
import { buildAdminPublicDealUrl } from "../../../lib/publicSite";

interface LeadLocaleMetadata {
  title: string;
  summary: string;
}

interface PublishedLeadLocale {
  locale: "en" | "zh";
  slug: string;
}

interface LeadDetailRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  sourceScore: number | null;
  sourceSnapshot: string | null;
  createdAt: string;
  review: LeadReviewDraft;
  publishedLocales?: PublishedLeadLocale[];
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

function normalizePublishedLeadLocales(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const locales = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const locale = readString(item.locale);
      const slug = readString(item.slug);

      if ((locale !== "en" && locale !== "zh") || !slug) {
        return null;
      }

      return {
        locale,
        slug,
      } as PublishedLeadLocale;
    })
    .filter((item): item is PublishedLeadLocale => item !== null);

  return locales.length > 0 ? locales : undefined;
}

function getPublishedLocaleLabel(locale: "en" | "zh") {
  return locale === "zh" ? "Chinese public deal" : "English public deal";
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
    sourceName: readString(lead.sourceName),
    originalTitle,
    originalUrl: readString(lead.originalUrl),
    snippet,
    sourceScore:
      typeof lead.sourceScore === "number" && Number.isFinite(lead.sourceScore)
        ? lead.sourceScore
        : null,
    sourceSnapshot: readString(lead.sourceSnapshot) || null,
    createdAt,
    review: buildLeadReviewDraft(review, originalTitle, snippet, createdAt),
    publishedLocales: normalizePublishedLeadLocales(lead.publishedLocales),
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
        publishedLocales: undefined,
        error: "Failed to publish deal.",
      };
    }

    const body = await response.json().catch(() => null);

    return {
      publishedLocales: normalizePublishedLeadLocales(isRecord(body) ? body.locales : undefined),
      error: null,
    };
  } catch {
    return {
      publishedLocales: undefined,
      error: "Failed to publish deal.",
    };
  }
}

async function rerunLeadReview(leadId: string) {
  try {
    const response = await fetch(`/v1/admin/leads/${leadId}/rerun-review`, {
      method: "POST",
    });

    if (!response.ok) {
      return {
        review: null,
        error: "Failed to rerun AI review.",
      };
    }

    return {
      review: await response.json(),
      error: null,
    };
  } catch {
    return {
      review: null,
      error: "Failed to rerun AI review.",
    };
  }
}

async function discardLead(leadId: string) {
  try {
    const response = await fetch(`/v1/admin/leads/${leadId}/discard`, {
      method: "POST",
    });

    if (!response.ok) {
      return {
        error: "Failed to discard lead.",
      };
    }

    return {
      error: null,
    };
  } catch {
    return {
      error: "Failed to discard lead.",
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

  function updateLeadReview(
    submission: LeadReviewSubmission,
    publishedLocales?: PublishedLeadLocale[],
  ) {
    setLead((currentLead) =>
      currentLead
        ? {
            ...currentLead,
            review: {
              category: submission.category,
              confidence: submission.confidence,
              riskLabels: submission.riskLabels,
              tags: submission.tags,
              featuredSlot: submission.featuredSlot,
              publishAt: submission.publishAt,
              locales: submission.locales,
            },
            publishedLocales: publishedLocales ?? currentLead.publishedLocales,
          }
        : currentLead,
    );
  }

  async function handleSubmit(submission: LeadReviewSubmission) {
    setFeedback(null);

    if (!submission.publish) {
      const result = await submitLeadReview(submission);

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      updateLeadReview(submission);
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

    updateLeadReview(draftSubmission);
    const publishResult = await publishLeadReview(submission);

    if (publishResult.error) {
      setFeedback("Draft saved, but failed to publish deal.");
      return;
    }

    updateLeadReview(submission, publishResult.publishedLocales);
    setFeedback("Deal published.");
  }

  async function handleRerunReview() {
    if (!lead) {
      return;
    }

    setFeedback(null);
    const result = await rerunLeadReview(lead.id);

    if (result.error || !result.review) {
      setFeedback("Failed to rerun AI review.");
      return;
    }

    setLead((currentLead) =>
      currentLead
        ? {
            ...currentLead,
            review: buildLeadReviewDraft(
              result.review,
              currentLead.originalTitle,
              currentLead.snippet,
              currentLead.createdAt,
            ),
          }
        : currentLead,
    );
    setFeedback("AI review rerun.");
  }

  async function handleDiscardLead() {
    if (!lead) {
      return;
    }

    setFeedback(null);
    const result = await discardLead(lead.id);

    if (result.error) {
      setFeedback("Failed to discard lead.");
      return;
    }

    setFeedback("Lead discarded.");
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
              <dt>Source</dt>
              <dd>{lead.sourceName || lead.sourceId || "Unknown"}</dd>
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
              <dt>Published public deals</dt>
              <dd>
                {lead.publishedLocales && lead.publishedLocales.length > 0 ? (
                  lead.publishedLocales.map((publishedLocale) => (
                    <React.Fragment key={`${lead.id}:${publishedLocale.locale}`}>
                      <a
                        href={buildAdminPublicDealUrl(
                          publishedLocale.locale,
                          publishedLocale.slug,
                        )}
                      >
                        {getPublishedLocaleLabel(publishedLocale.locale)}
                      </a>{" "}
                    </React.Fragment>
                  ))
                ) : (
                  "Not published yet"
                )}
              </dd>
              <dt>Source score</dt>
              <dd>{lead.sourceScore ?? "Unknown"}</dd>
              <dt>Source snapshot</dt>
              <dd>{lead.sourceSnapshot ? <pre>{lead.sourceSnapshot}</pre> : "No source snapshot"}</dd>
              <dt>Created at</dt>
              <dd>{lead.createdAt || "Unknown"}</dd>
            </dl>
            <p>
              <button
                onClick={() => {
                  void handleRerunReview();
                }}
                type="button"
              >
                Rerun AI review
              </button>{" "}
              <button
                onClick={() => {
                  void handleDiscardLead();
                }}
                type="button"
              >
                Discard lead
              </button>
            </p>
          </section>

          <LeadReviewForm
            key={`${lead.id}:${lead.review.locales.en.title}:${lead.review.locales.zh.title}:${lead.review.publishAt}:${lead.review.featuredSlot}:${lead.review.tags.join(",")}`}
            initialReview={lead.review}
            leadId={lead.id}
            onSubmit={handleSubmit}
          />
        </>
      )}
    </main>
  );
}
