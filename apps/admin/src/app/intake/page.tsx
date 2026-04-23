import React from "react";
import { redirect } from "next/navigation";
import {
  buildIntakeRedirectTarget,
  buildLeadHandoffInput,
  canCreateLead,
  submitLeadHandoffFromForm,
} from "../../lib/intakeHandoff";

interface IntakeSearchParams {
  sourceId?: string | string[];
  originalTitle?: string | string[];
  originalUrl?: string | string[];
  snippet?: string | string[];
  status?: string | string[];
}

interface ReviewLocalePreview {
  title?: string;
  summary?: string;
}

interface ReviewPreview {
  category?: string;
  confidence?: number;
  riskLabels?: string[];
  locales?: {
    en?: ReviewLocalePreview;
    zh?: ReviewLocalePreview;
  };
}

interface ReviewPreviewResult {
  review: ReviewPreview | null;
  error: string | null;
}

function getAdminApiBaseUrl() {
  return process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001";
}

function readSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

async function loadReviewPreview(
  originalTitle: string,
  snippet: string,
): Promise<ReviewPreviewResult> {
  if (!originalTitle) {
    return {
      review: null,
      error: null,
    };
  }

  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/v1/admin/review-preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originalTitle,
        snippet,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        review: null,
        error: "Failed to load intake preview.",
      };
    }

    const body = (await response.json()) as ReviewPreview;

    return {
      review: body,
      error: null,
    };
  } catch {
    return {
      review: null,
      error: "Failed to load intake preview.",
    };
  }
}

interface IntakePageProps {
  searchParams?: Promise<IntakeSearchParams>;
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const sourceId = readSearchParam(resolvedSearchParams.sourceId);
  const originalTitle = readSearchParam(resolvedSearchParams.originalTitle);
  const originalUrl = readSearchParam(resolvedSearchParams.originalUrl);
  const snippet = readSearchParam(resolvedSearchParams.snippet);
  const status = readSearchParam(resolvedSearchParams.status);
  const { review, error } = await loadReviewPreview(originalTitle, snippet);
  const handoffInput = {
    sourceId,
    originalTitle,
    originalUrl,
    snippet,
  };
  const canHandOffLead = review !== null && canCreateLead(handoffInput);
  const feedbackMessage = status === "handoff_error" ? "Failed to create lead." : null;

  async function handleCreateLead(formData: FormData) {
    "use server";

    const result = await submitLeadHandoffFromForm(formData);

    if (result.status === "success") {
      redirect(`/leads/${result.leadId}`);
    }

    const input = buildLeadHandoffInput(formData);
    redirect(
      buildIntakeRedirectTarget({
        status: "handoff_error",
        sourceId: input.sourceId,
        originalTitle: input.originalTitle,
        originalUrl: input.originalUrl,
        snippet: input.snippet,
      }),
    );
  }

  return (
    <main>
      <h1>Intake preview</h1>
      <p>Enter a raw lead and preview the localized AI review before saving.</p>
      {feedbackMessage ? <p>{feedbackMessage}</p> : null}

      <form action="/intake" method="get">
        <p>
          <label htmlFor="sourceId">Source ID</label>
          <br />
          <input id="sourceId" name="sourceId" type="text" defaultValue={sourceId} />
        </p>
        <p>
          <label htmlFor="originalTitle">Original title</label>
          <br />
          <input
            id="originalTitle"
            name="originalTitle"
            type="text"
            defaultValue={originalTitle}
          />
        </p>
        <p>
          <label htmlFor="originalUrl">Original URL</label>
          <br />
          <input id="originalUrl" name="originalUrl" type="url" defaultValue={originalUrl} />
        </p>
        <p>
          <label htmlFor="snippet">Snippet</label>
          <br />
          <textarea id="snippet" name="snippet" defaultValue={snippet} />
        </p>
        <button type="submit">Preview AI review</button>
      </form>

      {error ? (
        <p>{error}</p>
      ) : review ? (
        <section>
          <h2>AI review preview</h2>
          <dl>
            <dt>Category</dt>
            <dd>{review.category ?? "Unknown"}</dd>
            <dt>Confidence</dt>
            <dd>{review.confidence ?? "N/A"}</dd>
          </dl>

          <h3>Risk labels</h3>
          {review.riskLabels && review.riskLabels.length > 0 ? (
            <ul>
              {review.riskLabels.map((riskLabel) => (
                <li key={riskLabel}>{riskLabel}</li>
              ))}
            </ul>
          ) : (
            <p>No risk labels returned.</p>
          )}

          <h3>English copy</h3>
          <p>{review.locales?.en?.title ?? "No English title returned."}</p>
          <p>{review.locales?.en?.summary ?? "No English summary returned."}</p>

          <h3>Chinese copy</h3>
          <p>{review.locales?.zh?.title ?? "No Chinese title returned."}</p>
          <p>{review.locales?.zh?.summary ?? "No Chinese summary returned."}</p>

          <h3>Create lead handoff</h3>
          {canHandOffLead ? (
            <form action={handleCreateLead}>
              <input name="sourceId" type="hidden" value={sourceId} />
              <input name="originalTitle" type="hidden" value={originalTitle} />
              <input name="originalUrl" type="hidden" value={originalUrl} />
              <input name="snippet" type="hidden" value={snippet} />
              <button type="submit">Create lead</button>
            </form>
          ) : (
            <p>Add a source ID and original URL before handing this lead off.</p>
          )}
        </section>
      ) : (
        <p>Submit an original title and snippet to load the intake preview.</p>
      )}
    </main>
  );
}
