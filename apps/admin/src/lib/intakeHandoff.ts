interface LeadHandoffInput {
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
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
  };
}

export function canCreateLead(input: LeadHandoffInput) {
  return (
    isNonEmptyString(input.sourceId) &&
    isNonEmptyString(input.originalTitle) &&
    isNonEmptyString(input.originalUrl) &&
    isNonEmptyString(input.snippet)
  );
}

export function buildIntakeRedirectTarget({
  status,
  sourceId,
  originalTitle,
  originalUrl,
  snippet,
}: {
  status?: string;
  sourceId?: string;
  originalTitle?: string;
  originalUrl?: string;
  snippet?: string;
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

  const query = searchParams.toString();

  return query ? `/intake?${query}` : "/intake";
}

export async function submitLeadHandoffFromForm(
  formData: FormData,
): Promise<LeadHandoffSuccess | LeadHandoffError> {
  const input = buildLeadHandoffInput(formData);

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
