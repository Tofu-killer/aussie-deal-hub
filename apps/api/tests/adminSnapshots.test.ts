import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

interface PriceSnapshotRecord {
  label: string;
  merchant: string;
  observedAt: string;
  price: string;
}

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const selectedDealSlug = "nintendo-switch-oled-amazon-au";

describe("admin snapshot routes", () => {
  it("returns snapshots for a deal slug from the injected store", async () => {
    const snapshots: PriceSnapshotRecord[] = [
      {
        label: "Weekend promo",
        merchant: "Amazon AU",
        observedAt: "2026-04-20T00:00:00.000Z",
        price: "389.00",
      },
    ];
    const app = buildApp({
      adminSnapshotsStore: {
        async listForDeal(dealSlug: string) {
          return dealSlug === selectedDealSlug ? snapshots : [];
        },
      },
    } as never);

    const response = await dispatchRequest(app, {
      method: "GET",
      path: `/v1/admin/price-snapshots/${selectedDealSlug}`,
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      snapshots,
    });
  });

  it("replaces all snapshots for a deal slug and returns the stored result", async () => {
    const stored = new Map<string, PriceSnapshotRecord[]>([
      [
        selectedDealSlug,
        [
          {
            label: "Old promo",
            merchant: "Amazon AU",
            observedAt: "2026-04-01T00:00:00.000Z",
            price: "429.00",
          },
        ],
      ],
    ]);
    const replacement: PriceSnapshotRecord[] = [
      {
        label: "Current deal",
        merchant: "Amazon AU",
        observedAt: "2026-04-24T00:00:00.000Z",
        price: "399.00",
      },
      {
        label: "Member sale",
        merchant: "Amazon AU",
        observedAt: "2026-04-25T00:00:00.000Z",
        price: "389.00",
      },
    ];
    const app = buildApp({
      adminSnapshotsStore: {
        async listForDeal(dealSlug: string) {
          return stored.get(dealSlug) ?? [];
        },
        async replaceForDeal(dealSlug: string, snapshots: PriceSnapshotRecord[]) {
          stored.set(
            dealSlug,
            snapshots.map((snapshot) => ({ ...snapshot })),
          );

          return stored.get(dealSlug) ?? [];
        },
      },
    } as never);

    const putResponse = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/price-snapshots/${selectedDealSlug}`,
      body: {
        snapshots: replacement,
      },
    });
    const getResponse = await dispatchRequest(app, {
      method: "GET",
      path: `/v1/admin/price-snapshots/${selectedDealSlug}`,
    });

    expect(putResponse.status).toBe(200);
    expect(putResponse.body).toEqual({
      snapshots: replacement,
    });
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({
      snapshots: replacement,
    });
  });

  it("rejects invalid snapshot replacement payloads", async () => {
    const app = buildApp({
      adminSnapshotsStore: {
        async listForDeal() {
          return [];
        },
        async replaceForDeal() {
          throw new Error("should not be called");
        },
      },
    } as never);

    const response = await dispatchRequest(app, {
      method: "PUT",
      path: `/v1/admin/price-snapshots/${selectedDealSlug}`,
      body: {
        snapshots: [
          {
            label: "Broken snapshot",
            merchant: "",
            observedAt: "not-a-date",
            price: "399.00",
          },
        ],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Price snapshot payload is invalid.",
    });
  });
});

describeDb("admin snapshot persistence", () => {
  it("replaces persisted snapshots via the admin API and reads them back", async () => {
    const { prisma } = await import("@aussie-deal-hub/db/client");
    const {
      listPriceSnapshotsForDeal,
      replacePriceSnapshotsForDeal,
    } = await import("@aussie-deal-hub/db/repositories/priceSnapshots");
    const originalSnapshots = await listPriceSnapshotsForDeal(selectedDealSlug);
    const replacement: PriceSnapshotRecord[] = [
      {
        label: "Admin current deal",
        merchant: "Amazon AU",
        observedAt: "2025-04-18T00:00:00.000Z",
        price: "379.00",
      },
      {
        label: "Admin follow-up",
        merchant: "Amazon AU",
        observedAt: "2025-04-21T00:00:00.000Z",
        price: "369.00",
      },
    ];
    const app = buildApp({
      adminSnapshotsStore: {
        listForDeal: listPriceSnapshotsForDeal,
        replaceForDeal: replacePriceSnapshotsForDeal,
      },
    } as never);

    try {
      const putResponse = await dispatchRequest(app, {
        method: "PUT",
        path: `/v1/admin/price-snapshots/${selectedDealSlug}`,
        body: {
          snapshots: replacement,
        },
      });
      const persisted = await listPriceSnapshotsForDeal(selectedDealSlug);
      const getResponse = await dispatchRequest(app, {
        method: "GET",
        path: `/v1/admin/price-snapshots/${selectedDealSlug}`,
      });

      expect(putResponse.status).toBe(200);
      expect(putResponse.body).toEqual({
        snapshots: replacement,
      });
      expect(persisted).toEqual(replacement);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toEqual({
        snapshots: replacement,
      });
    } finally {
      await prisma.priceSnapshot.deleteMany({
        where: {
          dealSlug: selectedDealSlug,
        },
      });

      if (originalSnapshots.length > 0) {
        await replacePriceSnapshotsForDeal(selectedDealSlug, originalSnapshots);
      }
    }
  });
});
