"use client";

import React, { useState } from "react";

interface PriceSnapshot {
  label: string;
  merchant: string;
  observedAt: string;
  price: string;
}

interface SnapshotLoadResult {
  snapshots: PriceSnapshot[];
  error: string | null;
}

interface SnapshotSaveResult {
  snapshots: PriceSnapshot[];
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function createSnapshot(input?: Partial<PriceSnapshot>): PriceSnapshot {
  return {
    label: input?.label ?? "",
    merchant: input?.merchant ?? "",
    observedAt: input?.observedAt ?? "",
    price: input?.price ?? "",
  };
}

function normalizeSnapshot(value: unknown): PriceSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const label = readString(value.label);
  const merchant = readString(value.merchant);
  const observedAt = readString(value.observedAt);
  const price = readString(value.price);

  if (!label || !merchant || !observedAt || !price) {
    return null;
  }

  return createSnapshot({
    label,
    merchant,
    observedAt,
    price,
  });
}

function extractSnapshots(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.snapshots)) {
    return body.snapshots;
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  return [];
}

function getSnapshotCountMessage(count: number) {
  return `Loaded ${count} ${count === 1 ? "snapshot" : "snapshots"}.`;
}

function trimSnapshot(snapshot: PriceSnapshot) {
  return createSnapshot({
    label: snapshot.label.trim(),
    merchant: snapshot.merchant.trim(),
    observedAt: snapshot.observedAt.trim(),
    price: snapshot.price.trim(),
  });
}

function validateSnapshots(snapshots: PriceSnapshot[]) {
  const normalizedSnapshots = snapshots
    .map((snapshot) => trimSnapshot(snapshot))
    .filter((snapshot) =>
      snapshot.label || snapshot.merchant || snapshot.observedAt || snapshot.price
    );

  const hasIncompleteSnapshot = normalizedSnapshots.some((snapshot) =>
    !snapshot.label || !snapshot.merchant || !snapshot.observedAt || !snapshot.price
  );

  if (hasIncompleteSnapshot) {
    return {
      snapshots: [],
      error: "Complete every snapshot row before saving.",
    };
  }

  return {
    snapshots: normalizedSnapshots,
    error: null,
  };
}

async function loadSnapshots(dealSlug: string): Promise<SnapshotLoadResult> {
  try {
    const response = await fetch(`/v1/admin/price-snapshots/${encodeURIComponent(dealSlug)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        snapshots: [],
        error: "Failed to load snapshots.",
      };
    }

    return {
      snapshots: extractSnapshots(await response.json())
        .map((snapshot) => normalizeSnapshot(snapshot))
        .filter((snapshot): snapshot is PriceSnapshot => snapshot !== null),
      error: null,
    };
  } catch {
    return {
      snapshots: [],
      error: "Failed to load snapshots.",
    };
  }
}

async function saveSnapshots(
  dealSlug: string,
  snapshots: PriceSnapshot[],
): Promise<SnapshotSaveResult> {
  try {
    const response = await fetch(`/v1/admin/price-snapshots/${encodeURIComponent(dealSlug)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snapshots,
      }),
    });

    if (!response.ok) {
      return {
        snapshots: [],
        error: "Failed to save snapshots.",
      };
    }

    return {
      snapshots: extractSnapshots(await response.json())
        .map((snapshot) => normalizeSnapshot(snapshot))
        .filter((snapshot): snapshot is PriceSnapshot => snapshot !== null),
      error: null,
    };
  } catch {
    return {
      snapshots: [],
      error: "Failed to save snapshots.",
    };
  }
}

export default function SnapshotsPage() {
  const [dealSlug, setDealSlug] = useState("");
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function updateSnapshot(index: number, field: keyof PriceSnapshot, value: string) {
    setSnapshots((currentSnapshots) =>
      currentSnapshots.map((snapshot, snapshotIndex) =>
        snapshotIndex === index
          ? createSnapshot({
              label: field === "label" ? value : snapshot.label,
              merchant: field === "merchant" ? value : snapshot.merchant,
              observedAt: field === "observedAt" ? value : snapshot.observedAt,
              price: field === "price" ? value : snapshot.price,
            })
          : snapshot
      )
    );
  }

  function handleAddSnapshot() {
    setSnapshots((currentSnapshots) => [...currentSnapshots, createSnapshot()]);
    setFeedback(null);
    setError(null);
  }

  function handleRemoveSnapshot(index: number) {
    setSnapshots((currentSnapshots) =>
      currentSnapshots.filter((_, snapshotIndex) => snapshotIndex !== index)
    );
    setFeedback(null);
    setError(null);
  }

  async function handleLoad() {
    const trimmedDealSlug = dealSlug.trim();

    if (!trimmedDealSlug) {
      setError("Enter a deal slug.");
      setFeedback(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFeedback(null);

    const result = await loadSnapshots(trimmedDealSlug);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setDealSlug(trimmedDealSlug);
    setSnapshots(result.snapshots);
    setFeedback(getSnapshotCountMessage(result.snapshots.length));
  }

  async function handleSave() {
    const trimmedDealSlug = dealSlug.trim();

    if (!trimmedDealSlug) {
      setError("Enter a deal slug.");
      setFeedback(null);
      return;
    }

    const validated = validateSnapshots(snapshots);

    if (validated.error) {
      setError(validated.error);
      setFeedback(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setFeedback(null);

    const result = await saveSnapshots(trimmedDealSlug, validated.snapshots);

    setIsSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSnapshots(result.snapshots);
    setFeedback("Snapshots saved.");
  }

  return (
    <main>
      <h1>Manage snapshots</h1>
      <p>Load selected price snapshots by deal slug, edit one row at a time, and save them back.</p>
      <div>
        <label htmlFor="deal-slug-input">Deal slug</label>
        <input
          id="deal-slug-input"
          name="dealSlug"
          type="text"
          value={dealSlug}
          onChange={(event) => setDealSlug(event.target.value)}
          placeholder="nintendo-switch-oled-amazon-au"
        />
        <button type="button" onClick={() => void handleLoad()} disabled={isLoading}>
          {isLoading ? "Loading..." : "Load snapshots"}
        </button>
      </div>
      <section aria-labelledby="snapshots-heading">
        <h2 id="snapshots-heading">Snapshots</h2>
        <p>Each row maps to one snapshot: label, merchant, observed timestamp, and price.</p>
        <button
          type="button"
          onClick={handleAddSnapshot}
          disabled={isLoading || isSaving || !dealSlug.trim()}
        >
          Add snapshot
        </button>
        {snapshots.length === 0 ? <p>No snapshots loaded.</p> : null}
        {snapshots.map((snapshot, index) => (
          <fieldset key={index}>
            <legend>Snapshot {index + 1}</legend>
            <div>
              <label htmlFor={`snapshot-label-${index}`}>Label {index + 1}</label>
              <input
                id={`snapshot-label-${index}`}
                type="text"
                value={snapshot.label}
                onChange={(event) => updateSnapshot(index, "label", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`snapshot-merchant-${index}`}>Merchant {index + 1}</label>
              <input
                id={`snapshot-merchant-${index}`}
                type="text"
                value={snapshot.merchant}
                onChange={(event) => updateSnapshot(index, "merchant", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`snapshot-observed-at-${index}`}>Observed at {index + 1}</label>
              <input
                id={`snapshot-observed-at-${index}`}
                type="text"
                value={snapshot.observedAt}
                onChange={(event) => updateSnapshot(index, "observedAt", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`snapshot-price-${index}`}>Price {index + 1}</label>
              <input
                id={`snapshot-price-${index}`}
                type="text"
                value={snapshot.price}
                onChange={(event) => updateSnapshot(index, "price", event.target.value)}
              />
            </div>
            <button type="button" onClick={() => handleRemoveSnapshot(index)}>
              Remove snapshot {index + 1}
            </button>
          </fieldset>
        ))}
      </section>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isLoading || isSaving || !dealSlug.trim()}
      >
        {isSaving ? "Saving..." : "Save snapshots"}
      </button>
      {feedback ? <p>{feedback}</p> : null}
      {error ? <p>{error}</p> : null}
    </main>
  );
}
