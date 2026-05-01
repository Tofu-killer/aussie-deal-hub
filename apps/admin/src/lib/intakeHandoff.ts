import { resolveLeadSourceEvidence } from "@aussie-deal-hub/config/leadSourceEvidence";

import { getAdminApiBaseUrl } from "./runtimeApi";

export interface LeadHandoffInput {
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  sourceSnapshot?: string;
}

interface ReviewLocalePreview {
  title?: string;
  summary?: string;
}

export interface ReviewPreview {
  category?: string;
  confidence?: number;
  riskLabels?: string[];
  locales?: {
    en?: ReviewLocalePreview;
    zh?: ReviewLocalePreview;
  };
}

interface ReviewPreviewSuccess {
  review: ReviewPreview;
  error: null;
}

interface ReviewPreviewError {
  review: null;
  error: string | null;
}

interface LeadHandoffSuccess {
  status: "success";
  leadId: string;
}

interface LeadHandoffError {
  status: "error";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildAdminApiUrl(path: string, apiBaseUrl?: string) {
  if (!apiBaseUrl) {
    return path;
  }

  return `${apiBaseUrl.replace(/\/+$/, "")}${path}`;
}

function readFormValue(formData: FormData, fieldName: keyof LeadHandoffInput) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

export function buildLeadHandoffInput(formData: FormData): LeadHandoffInput {
  return {
    sourceId: readFormValue(formData, "sourceId"),
    originalTitle: readFormValue(formData, "originalTitle"),
    originalUrl: readFormValue(formData, "originalUrl"),
    snippet: readFormValue(formData, "snippet"),
    sourceSnapshot: readFormValue(formData, "sourceSnapshot"),
  };
}

export function resolveLeadHandoffInput<T extends LeadHandoffInput>(input: T): T {
  return resolveLeadSourceEvidence(input);
}

export function canPreviewLead(input: LeadHandoffInput) {
  return isNonEmptyString(resolveLeadHandoffInput(input).originalTitle);
}

export function canCreateLead(input: LeadHandoffInput) {
  const resolvedInput = resolveLeadHandoffInput(input);

  return (
    isNonEmptyString(resolvedInput.sourceId) &&
    isNonEmptyString(resolvedInput.originalTitle) &&
    isNonEmptyString(resolvedInput.originalUrl) &&
    isNonEmptyString(resolvedInput.snippet)
  );
}

export async function loadLeadReviewPreview(
  input: LeadHandoffInput,
  options?: {
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<ReviewPreviewSuccess | ReviewPreviewError> {
  if (!canPreviewLead(input)) {
    return {
      review: null,
      error: null,
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(buildAdminApiUrl("/v1/admin/review-preview", options?.apiBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        originalTitle: input.originalTitle,
        originalUrl: input.originalUrl,
        snippet: input.snippet,
        sourceSnapshot: input.sourceSnapshot ?? "",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        review: null,
        error: "Failed to load intake preview.",
      };
    }

    return {
      review: (await response.json()) as ReviewPreview,
      error: null,
    };
  } catch {
    return {
      review: null,
      error: "Failed to load intake preview.",
    };
  }
}

export async function submitLeadHandoff(
  input: LeadHandoffInput,
  options?: {
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<LeadHandoffSuccess | LeadHandoffError> {
  const resolvedInput = resolveLeadHandoffInput(input);

  if (!canCreateLead(resolvedInput)) {
    return {
      status: "error",
    };
  }

  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(buildAdminApiUrl("/v1/admin/leads", options?.apiBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resolvedInput),
    });

    if (!response.ok) {
      return {
        status: "error",
      };
    }

    const body = (await response.json()) as { id?: string };

    if (!isNonEmptyString(body.id)) {
      return {
        status: "error",
      };
    }

    return {
      status: "success",
      leadId: body.id,
    };
  } catch {
    return {
      status: "error",
    };
  }
}

export async function submitLeadHandoffFromForm(
  formData: FormData,
): Promise<LeadHandoffSuccess | LeadHandoffError> {
  return submitLeadHandoff(buildLeadHandoffInput(formData), {
    apiBaseUrl: getAdminApiBaseUrl(),
  });
}
