import React from "react";

import { buildAdminApiUrl } from "../../lib/runtimeApi";

interface LeadQueueItem {
  id: string;
  sourceId: string;
  sourceName: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  createdAt: string;
  queue: {
    status: string;
    label: string;
  };
}

interface LeadQueueResponse {
  items?: unknown;
  leads?: unknown;
}

interface LeadQueueLoadResult {
  items: LeadQueueItem[];
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function getLeadQueueLabel(status: string) {
  switch (status) {
    case "published":
      return "Published";
    case "draft_saved":
      return "Draft saved";
    case "queued_to_publish":
      return "Queued to publish";
    default:
      return "Pending review";
  }
}

function normalizeLeadQueueSummary(value: unknown, reviewValue: unknown) {
  const queue = isRecord(value) ? value : {};
  const review = isRecord(reviewValue) ? reviewValue : {};
  const fallbackStatus = readBoolean(review.publish)
    ? "queued_to_publish"
    : isRecord(reviewValue)
      ? "draft_saved"
      : "pending_review";
  const status = readString(queue.status) || fallbackStatus;

  return {
    status,
    label: readString(queue.label) || getLeadQueueLabel(status),
  };
}

function normalizeLeadQueueItem(value: unknown): LeadQueueItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    sourceId: readString(value.sourceId),
    sourceName: readString(value.sourceName),
    originalTitle: readString(value.originalTitle),
    originalUrl: readString(value.originalUrl),
    snippet: readString(value.snippet),
    createdAt: readString(value.createdAt),
    queue: normalizeLeadQueueSummary(value.queue, value.review),
  };
}

function extractLeadQueueItems(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  if (Array.isArray(body.leads)) {
    return body.leads;
  }

  return [];
}

async function loadLeadQueue(): Promise<LeadQueueLoadResult> {
  try {
    const response = await fetch(buildAdminApiUrl("/v1/admin/leads"), {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: "Failed to load lead queue.",
      };
    }

    const body = (await response.json()) as LeadQueueResponse | LeadQueueItem[];

    return {
      items: extractLeadQueueItems(body)
        .map((item) => normalizeLeadQueueItem(item))
        .filter((item): item is LeadQueueItem => item !== null),
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Failed to load lead queue.",
    };
  }
}

export default async function LeadsPage() {
  const { items, error } = await loadLeadQueue();

  return (
    <main>
      <h1>Lead queue</h1>
      <p>Open a lead to edit English and Chinese content before publishing.</p>
      {error ? (
        <p>{error}</p>
      ) : items.length === 0 ? (
        <p>No leads available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Lead ID</th>
              <th>Source</th>
              <th>Original title</th>
              <th>Original URL</th>
              <th>Status</th>
              <th>Created at</th>
            </tr>
          </thead>
          <tbody>
            {items.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <a href={`/leads/${lead.id}`}>{lead.id}</a>
                </td>
                <td>{lead.sourceName || lead.sourceId || "Unknown"}</td>
                <td>{lead.originalTitle || "Untitled lead"}</td>
                <td>
                  {lead.originalUrl ? (
                    <a href={lead.originalUrl}>{lead.originalUrl}</a>
                  ) : (
                    "No URL"
                  )}
                </td>
                <td>{lead.queue.label}</td>
                <td>{lead.createdAt || "Unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
