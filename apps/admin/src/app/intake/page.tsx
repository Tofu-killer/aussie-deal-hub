import React from "react";
import IntakeWorkspace from "../../components/IntakeWorkspace";

interface IntakeSearchParams {
  sourceId?: string | string[];
  originalTitle?: string | string[];
  originalUrl?: string | string[];
  snippet?: string | string[];
  sourceSnapshot?: string | string[];
  status?: string | string[];
}

interface IntakePageProps {
  searchParams?: Promise<IntakeSearchParams>;
}

function readSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <IntakeWorkspace
      initialInput={{
        sourceId: readSearchParam(resolvedSearchParams.sourceId),
        originalTitle: readSearchParam(resolvedSearchParams.originalTitle),
        originalUrl: readSearchParam(resolvedSearchParams.originalUrl),
        snippet: readSearchParam(resolvedSearchParams.snippet),
        sourceSnapshot: readSearchParam(resolvedSearchParams.sourceSnapshot),
      }}
      initialStatus={readSearchParam(resolvedSearchParams.status)}
    />
  );
}
