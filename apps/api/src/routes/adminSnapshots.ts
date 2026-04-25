import { Router } from "express";

export interface PriceSnapshotRecord {
  label: string;
  merchant: string;
  observedAt: string;
  price: string;
}

export interface AdminSnapshotsStore {
  listForDeal(dealSlug: string): Promise<PriceSnapshotRecord[]>;
  replaceForDeal(dealSlug: string, snapshots: PriceSnapshotRecord[]): Promise<PriceSnapshotRecord[]>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isParseableDateTimeString(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function isPriceString(value: unknown): value is string {
  return isNonEmptyString(value) && /^\d+(?:\.\d{1,2})?$/.test(value.trim());
}

function isSnapshotRecord(value: unknown): value is PriceSnapshotRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    isNonEmptyString(record.label) &&
    isNonEmptyString(record.merchant) &&
    isParseableDateTimeString(record.observedAt) &&
    isPriceString(record.price)
  );
}

function readDealSlug(value: unknown) {
  return isNonEmptyString(value) ? value.trim() : "";
}

function readSnapshots(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const input = value as Record<string, unknown>;

  return Array.isArray(input.snapshots) ? input.snapshots : null;
}

export function createAdminSnapshotsRouter(store: Partial<AdminSnapshotsStore> = {}) {
  const router = Router();

  router.get("/price-snapshots/:dealSlug", async (request, response) => {
    if (!store.listForDeal) {
      response.status(503).json({ message: "Price snapshot store is not configured." });
      return;
    }

    const dealSlug = readDealSlug(request.params.dealSlug);

    if (!dealSlug) {
      response.status(400).json({ message: "Deal slug is required." });
      return;
    }

    response.json({
      snapshots: await store.listForDeal(dealSlug),
    });
  });

  router.put("/price-snapshots/:dealSlug", async (request, response) => {
    const dealSlug = readDealSlug(request.params.dealSlug);
    const snapshots = readSnapshots(request.body);

    if (!dealSlug || !snapshots || !snapshots.every((item) => isSnapshotRecord(item))) {
      response.status(400).json({ message: "Price snapshot payload is invalid." });
      return;
    }

    if (!store.replaceForDeal) {
      response.status(503).json({ message: "Price snapshot store is not configured." });
      return;
    }

    response.json({
      snapshots: await store.replaceForDeal(dealSlug, snapshots),
    });
  });

  return router;
}
