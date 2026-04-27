"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  canCreateLead,
  canPreviewLead,
  loadLeadReviewPreview,
  resolveLeadHandoffInput,
  submitLeadHandoff,
  type LeadHandoffInput,
  type ReviewPreview,
} from "../lib/intakeHandoff";

interface IntakeWorkspaceProps {
  initialInput: LeadHandoffInput;
  initialStatus?: string;
}

function sameLeadHandoffInput(left: LeadHandoffInput, right: LeadHandoffInput) {
  return (
    left.sourceId === right.sourceId &&
    left.originalTitle === right.originalTitle &&
    left.originalUrl === right.originalUrl &&
    left.snippet === right.snippet &&
    (left.sourceSnapshot ?? "") === (right.sourceSnapshot ?? "")
  );
}

export default function IntakeWorkspace({
  initialInput,
  initialStatus,
}: IntakeWorkspaceProps) {
  const [form, setForm] = useState<LeadHandoffInput>(initialInput);
  const [review, setReview] = useState<ReviewPreview | null>(null);
  const [previewedInput, setPreviewedInput] = useState<LeadHandoffInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(
    initialStatus === "handoff_error" ? "Failed to create lead." : null,
  );
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const previewRequestIdRef = useRef(0);
  const didRunInitialPreviewRef = useRef(false);

  const resolvedHandoffInput = resolveLeadHandoffInput(form);
  const isPreviewCurrent =
    previewedInput !== null && review !== null && sameLeadHandoffInput(form, previewedInput);
  const canHandOffLead = isPreviewCurrent && canCreateLead(form);

  async function runPreview(input: LeadHandoffInput, clearFeedback: boolean) {
    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    if (clearFeedback) {
      setFeedbackMessage(null);
    }

    setIsPreviewing(true);
    setError(null);

    const result = await loadLeadReviewPreview(input);

    if (previewRequestIdRef.current !== requestId) {
      return;
    }

    setIsPreviewing(false);
    setError(result.error);
    setReview(result.review);
    setPreviewedInput(result.review ? { ...input } : null);
  }

  useEffect(() => {
    if (didRunInitialPreviewRef.current) {
      return;
    }

    didRunInitialPreviewRef.current = true;

    if (!canPreviewLead(initialInput)) {
      return;
    }

    void runPreview(initialInput, false);
  }, [initialInput]);

  return (
    <main>
      <h1>Intake preview</h1>
      <p>Enter a raw lead and preview the localized AI review before saving.</p>
      {feedbackMessage ? <p>{feedbackMessage}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runPreview(form, true);
        }}
      >
        <p>
          <label htmlFor="sourceId">Source ID</label>
          <br />
          <input
            id="sourceId"
            name="sourceId"
            onChange={(event) => {
              setFeedbackMessage(null);
              setError(null);
              setForm((currentForm) => ({
                ...currentForm,
                sourceId: event.target.value,
              }));
            }}
            type="text"
            value={form.sourceId}
          />
        </p>
        <p>
          <label htmlFor="originalTitle">Original title</label>
          <br />
          <input
            id="originalTitle"
            name="originalTitle"
            onChange={(event) => {
              setFeedbackMessage(null);
              setError(null);
              setForm((currentForm) => ({
                ...currentForm,
                originalTitle: event.target.value,
              }));
            }}
            type="text"
            value={form.originalTitle}
          />
        </p>
        <p>
          <label htmlFor="originalUrl">Original URL</label>
          <br />
          <input
            id="originalUrl"
            name="originalUrl"
            onChange={(event) => {
              setFeedbackMessage(null);
              setError(null);
              setForm((currentForm) => ({
                ...currentForm,
                originalUrl: event.target.value,
              }));
            }}
            type="url"
            value={form.originalUrl}
          />
        </p>
        <p>
          <label htmlFor="snippet">Snippet</label>
          <br />
          <textarea
            id="snippet"
            name="snippet"
            onChange={(event) => {
              setFeedbackMessage(null);
              setError(null);
              setForm((currentForm) => ({
                ...currentForm,
                snippet: event.target.value,
              }));
            }}
            value={form.snippet}
          />
        </p>
        <p>
          <label htmlFor="sourceSnapshot">Source snapshot</label>
          <br />
          <textarea
            id="sourceSnapshot"
            name="sourceSnapshot"
            onChange={(event) => {
              setFeedbackMessage(null);
              setError(null);
              setForm((currentForm) => ({
                ...currentForm,
                sourceSnapshot: event.target.value,
              }));
            }}
            value={form.sourceSnapshot ?? ""}
          />
        </p>
        <button disabled={isPreviewing} type="submit">
          Preview AI review
        </button>
      </form>

      {error ? <p>{error}</p> : null}

      {isPreviewCurrent ? (
        <section>
          <h2>Raw evidence</h2>
          <dl>
            <dt>Original title</dt>
            <dd>{resolvedHandoffInput.originalTitle || "No original title provided."}</dd>
            <dt>Original URL</dt>
            <dd>{resolvedHandoffInput.originalUrl || "No original URL provided."}</dd>
            <dt>Snippet</dt>
            <dd>{resolvedHandoffInput.snippet || "No snippet provided."}</dd>
            <dt>Source snapshot</dt>
            <dd>{form.sourceSnapshot || "No source snapshot captured yet."}</dd>
          </dl>
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
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setFeedbackMessage(null);
                setIsCreating(true);

                void submitLeadHandoff(form).then((result) => {
                  setIsCreating(false);

                  if (result.status === "success") {
                    window.location.assign(`/leads/${result.leadId}`);
                    return;
                  }

                  setFeedbackMessage("Failed to create lead.");
                });
              }}
            >
              <button disabled={isCreating} type="submit">
                Create lead
              </button>
            </form>
          ) : (
            <p>Lead is missing required source metadata.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
