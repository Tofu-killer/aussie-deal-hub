export interface LeadHandoffInput {
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  sourceSnapshot?: string;
}

interface LeadHandoffSuccess {
  status: "success";
  leadId: string;
}

interface LeadHandoffError {
  status: "error";
}

function getAdminApiBaseUrl() {
  return process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseSourceSnapshot(sourceSnapshot?: string) {
  if (!sourceSnapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(sourceSnapshot) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractEvidenceField(value: unknown, fieldNames: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const fieldName of fieldNames) {
    const candidate = readNonEmptyTrimmedString(value[fieldName]);
    if (candidate) {
      return candidate;
    }
  }

  return null;
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
  const snapshot = parseSourceSnapshot(input.sourceSnapshot);
  const snapshotCandidate = isRecord(snapshot?.candidate) ? snapshot.candidate : null;
  const snapshotEvidence = isRecord(snapshot?.rawEvidence) ? snapshot.rawEvidence : null;

  return {
    ...input,
    originalTitle:
      readNonEmptyTrimmedString(input.originalTitle) ??
      extractEvidenceField(snapshotCandidate, ["title", "originalTitle"]) ??
      extractEvidenceField(snapshotEvidence, ["originalTitle", "title"]) ??
      "",
    originalUrl:
      readNonEmptyTrimmedString(input.originalUrl) ??
      extractEvidenceField(snapshotCandidate, ["originalUrl", "url", "canonicalUrl"]) ??
      extractEvidenceField(snapshotEvidence, ["originalUrl", "url", "canonicalUrl"]) ??
      "",
    snippet:
      readNonEmptyTrimmedString(input.snippet) ??
      extractEvidenceField(snapshotCandidate, ["snippet", "summary", "description", "excerpt"]) ??
      extractEvidenceField(snapshotEvidence, ["snippet", "summary", "description", "excerpt"]) ??
      "",
  };
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

export function buildIntakeRedirectTarget({
  status,
  sourceId,
  originalTitle,
  originalUrl,
  snippet,
  sourceSnapshot,
}: {
  status?: string;
  sourceId?: string;
  originalTitle?: string;
  originalUrl?: string;
  snippet?: string;
  sourceSnapshot?: string;
}) {
  const searchParams = new URLSearchParams();

  if (status) {
    searchParams.set("status", status);
  }

  if (sourceId) {
    searchParams.set("sourceId", sourceId);
  }

  if (originalTitle) {
    searchParams.set("originalTitle", originalTitle);
  }

  if (originalUrl) {
    searchParams.set("originalUrl", originalUrl);
  }

  if (snippet) {
    searchParams.set("snippet", snippet);
  }

  if (sourceSnapshot) {
    searchParams.set("sourceSnapshot", sourceSnapshot);
  }

  const query = searchParams.toString();

  return query ? `/intake?${query}` : "/intake";
}

export async function submitLeadHandoffFromForm(
  formData: FormData,
): Promise<LeadHandoffSuccess | LeadHandoffError> {
  const input = resolveLeadHandoffInput(buildLeadHandoffInput(formData));

  if (!canCreateLead(input)) {
    return {
      status: "error",
    };
  }

  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/v1/admin/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
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
