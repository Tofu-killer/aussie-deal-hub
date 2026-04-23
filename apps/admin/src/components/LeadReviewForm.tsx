"use client";

import React, { type FormEvent } from "react";

export interface LeadReviewLocaleDraft {
  title: string;
  summary: string;
}

export interface LeadReviewDraft {
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
}

export interface LeadReviewSubmission extends LeadReviewDraft {
  leadId: string;
  publish: boolean;
}

export interface LeadReviewFormProps {
  leadId: string;
  initialReview: LeadReviewDraft;
  onSubmit?: (submission: LeadReviewSubmission) => void | Promise<void>;
}

interface NamedFormControl {
  value?: string;
}

interface NamedFormControls {
  namedItem(name: string): NamedFormControl | Element | RadioNodeList | null;
}

function hasValue(
  control: NamedFormControl | Element | RadioNodeList | null,
): control is NamedFormControl {
  return Boolean(control && typeof control === "object" && "value" in control);
}

function readFormValue(
  elements: NamedFormControls,
  name: string,
  fallback: string,
) {
  const control = elements.namedItem(name);
  return hasValue(control) ? control.value ?? fallback : fallback;
}

function formatDateTimeLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toDateTimeLocalValue(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 16);
  }
  return formatDateTimeLocal(parsed);
}

function toUtcIsoString(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

export function buildLeadReviewSubmission(
  leadId: string,
  initialReview: LeadReviewDraft,
  elements: NamedFormControls,
  publish: boolean,
): LeadReviewSubmission {
  const riskLabels = readFormValue(
    elements,
    "riskLabels",
    initialReview.riskLabels.join(", "),
  )
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const tags = readFormValue(elements, "tags", initialReview.tags.join(", "))
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    leadId,
    category: readFormValue(elements, "category", initialReview.category),
    confidence: Number(readFormValue(elements, "confidence", String(initialReview.confidence))) || 0,
    riskLabels,
    tags,
    featuredSlot: readFormValue(elements, "featuredSlot", initialReview.featuredSlot),
    publishAt: toUtcIsoString(
      readFormValue(
        elements,
        "publishAt",
        toDateTimeLocalValue(initialReview.publishAt),
      ),
    ),
    locales: {
      en: {
        title: readFormValue(elements, "locales.en.title", initialReview.locales.en.title),
        summary: readFormValue(elements, "locales.en.summary", initialReview.locales.en.summary),
      },
      zh: {
        title: readFormValue(elements, "locales.zh.title", initialReview.locales.zh.title),
        summary: readFormValue(elements, "locales.zh.summary", initialReview.locales.zh.summary),
      },
    },
    publish,
  };
}

export function LeadReviewForm({
  leadId,
  initialReview,
  onSubmit,
}: LeadReviewFormProps) {

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nativeEvent = event.nativeEvent as { submitter?: { value?: string } };
    const publish = nativeEvent.submitter?.value === "publish";

    await onSubmit?.({
      ...buildLeadReviewSubmission(leadId, initialReview, event.currentTarget.elements, publish),
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Lead review form</h2>
      <p>Prepare bilingual copy before publishing the deal.</p>

      <label>
        Category
        <input
          defaultValue={initialReview.category}
          name="category"
          type="text"
        />
      </label>

      <label>
        Confidence
        <input
          defaultValue={initialReview.confidence}
          name="confidence"
          type="number"
        />
      </label>

      <label>
        Risk labels
        <input
          defaultValue={initialReview.riskLabels.join(", ")}
          name="riskLabels"
          type="text"
        />
      </label>

      <label>
        Tags
        <input
          defaultValue={initialReview.tags.join(", ")}
          name="tags"
          type="text"
        />
      </label>

      <label>
        Featured slot
        <input
          defaultValue={initialReview.featuredSlot}
          name="featuredSlot"
          type="text"
        />
      </label>

      <label>
        Publish at
        <input
          defaultValue={toDateTimeLocalValue(initialReview.publishAt)}
          name="publishAt"
          type="datetime-local"
        />
      </label>

      <fieldset>
        <legend>English content</legend>

        <label>
          English title
          <input
            defaultValue={initialReview.locales.en.title}
            name="locales.en.title"
            type="text"
          />
        </label>

        <label>
          English summary
          <textarea
            defaultValue={initialReview.locales.en.summary}
            name="locales.en.summary"
          />
        </label>
      </fieldset>

      <fieldset>
        <legend>Chinese content</legend>

        <label>
          Chinese title
          <input
            defaultValue={initialReview.locales.zh.title}
            name="locales.zh.title"
            type="text"
          />
        </label>

        <label>
          Chinese summary
          <textarea
            defaultValue={initialReview.locales.zh.summary}
            name="locales.zh.summary"
          />
        </label>
      </fieldset>

      <div>
        <button type="submit" value="save">
          Save Draft
        </button>
        <button type="submit" value="publish">
          Publish Deal
        </button>
      </div>
    </form>
  );
}

export default LeadReviewForm;
