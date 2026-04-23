import React from "react";

interface PublishingQueueRow {
  id: string;
  deal: string;
  featuredSlot: string;
  publishAt: string;
  locale: string;
  status: string;
}

interface PublishingQueueLoadResult {
  items: PublishingQueueRow[];
  error: string | null;
}

function getAdminApiBaseUrl() {
  return process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizePublishingQueueRow(value: unknown): PublishingQueueRow | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    id,
    deal: readString(value.deal),
    featuredSlot: readString(value.featuredSlot),
    publishAt: readString(value.publishAt),
    locale: readString(value.locale),
    status: readString(value.status),
  };
}

function extractPublishingQueueItems(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  if (Array.isArray(body.queue)) {
    return body.queue;
  }

  return [];
}

async function loadPublishingQueue(): Promise<PublishingQueueLoadResult> {
  try {
    const response = await fetch(`${getAdminApiBaseUrl()}/v1/admin/publishing`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        items: [],
        error: "Failed to load publishing queue.",
      };
    }

    return {
      items: extractPublishingQueueItems(await response.json())
        .map((item) => normalizePublishingQueueRow(item))
        .filter((item): item is PublishingQueueRow => item !== null),
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Failed to load publishing queue.",
    };
  }
}

export default async function PublishingPage() {
  const { items, error } = await loadPublishingQueue();

  return (
    <main>
      <h1>Publishing queue</h1>
      <p>Review the live release order for scheduled admin publishing jobs.</p>
      {error ? (
        <p>{error}</p>
      ) : items.length === 0 ? (
        <p>No publishing jobs available.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Featured slot</th>
              <th>Publish at</th>
              <th>Locale</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.deal}</td>
                <td>{row.featuredSlot}</td>
                <td>{row.publishAt}</td>
                <td>{row.locale}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
