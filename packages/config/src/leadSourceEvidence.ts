interface LeadSourceSnapshot {
  candidate?: Record<string, unknown>;
  rawEvidence?: Record<string, unknown>;
}

export interface LeadSourceEvidenceInput {
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  sourceSnapshot?: string | null;
}

export interface LeadReviewEvidenceInput {
  originalTitle: string;
  snippet: string;
  sourceSnapshot?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseSourceSnapshot(sourceSnapshot?: string | null): LeadSourceSnapshot | null {
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

export function resolveLeadSourceEvidence<T extends LeadSourceEvidenceInput>(input: T): T {
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

export function resolveLeadReviewEvidence(input: LeadReviewEvidenceInput) {
  const resolvedInput = resolveLeadSourceEvidence({
    ...input,
    originalUrl: "",
  });

  return {
    originalTitle: resolvedInput.originalTitle,
    snippet: resolvedInput.snippet,
  };
}
