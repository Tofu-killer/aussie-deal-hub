import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import {
  listPriceSnapshotsForDeal,
  replacePriceSnapshotsForDeal,
} from "@aussie-deal-hub/db/repositories/priceSnapshots";
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
const seededSnapshots: PriceSnapshotRecord[] = [
  {
    label: "Previous promo",
    merchant: "Amazon AU",
    observedAt: "2025-03-14T00:00:00.000Z",
    price: "429.00",
  },
  {
    label: "Current public deal",
    merchant: "Amazon AU",
    observedAt: "2025-04-15T00:00:00.000Z",
    price: "399.00",
  },
];

async function clearSelectedPriceSnapshots() {
  await prisma.priceSnapshot.deleteMany({
    where: {
      dealSlug: selectedDealSlug,
    },
  });
}

describeDb("public deal price context", () => {
  it("writes and reads selected price snapshots for the published deal", async () => {
    try {
      await clearSelectedPriceSnapshots();

      const writtenSnapshots = await replacePriceSnapshotsForDeal(
        selectedDealSlug,
        seededSnapshots,
      );

      expect(writtenSnapshots).toEqual(seededSnapshots);

      const snapshots = await listPriceSnapshotsForDeal(selectedDealSlug);

      expect(snapshots).toEqual(seededSnapshots);
    } finally {
      await clearSelectedPriceSnapshots();
    }
  });

  it("returns persisted price-context snapshots from the public deal detail API", async () => {
    await clearSelectedPriceSnapshots();
    await replacePriceSnapshotsForDeal(selectedDealSlug, seededSnapshots);

    try {
      const app = buildApp({
        priceSnapshotStore: {
          listSnapshotsForDeal: listPriceSnapshotsForDeal,
        },
      });
      const response = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/public/deals/en/nintendo-switch-oled-amazon-au",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        locale: "en",
        slug: selectedDealSlug,
        priceContext: {
          snapshots: seededSnapshots,
        },
      });
    } finally {
      await clearSelectedPriceSnapshots();
    }
  });
});
