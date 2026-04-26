import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import {
  listPriceSnapshotsForDeal,
  replacePriceSnapshotsForDeal,
  seedSelectedPriceSnapshots,
  seededSelectedPriceSnapshots,
  selectedPriceSnapshotDealSlug,
  type PriceSnapshotRecord,
} from "@aussie-deal-hub/db/repositories/priceSnapshots";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const selectedDealSlug = selectedPriceSnapshotDealSlug;
const seededSnapshots: PriceSnapshotRecord[] = seededSelectedPriceSnapshots;

async function clearSelectedPriceSnapshots() {
  await prisma.priceSnapshot.deleteMany({
    where: {
      dealSlug: selectedDealSlug,
    },
  });
}

describeDb("public deal price context", () => {
  it("keeps migrated selected snapshots available for the published deal", async () => {
    expect(await listPriceSnapshotsForDeal(selectedDealSlug)).toEqual(seededSnapshots);
  });

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
      await seedSelectedPriceSnapshots();
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
      await seedSelectedPriceSnapshots();
    }
  });

  it("returns localized deal content alongside the same persisted snapshots", async () => {
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
        path: "/v1/public/deals/zh/nintendo-switch-oled-amazon-au",
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        locale: "zh",
        slug: selectedDealSlug,
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
        priceContext: {
          snapshots: seededSnapshots,
        },
      });
    } finally {
      await seedSelectedPriceSnapshots();
    }
  });

  it("writes and reads price snapshots for a second published deal slug", async () => {
    const secondDealSlug = "airpods-pro-2-costco-au";
    const snapshots: PriceSnapshotRecord[] = [
      {
        label: "Warehouse weekend",
        merchant: "Costco AU",
        observedAt: "2025-04-01T00:00:00.000Z",
        price: "299.00",
      },
    ];

    try {
      await prisma.priceSnapshot.deleteMany({
        where: {
          dealSlug: secondDealSlug,
        },
      });

      const writtenSnapshots = await replacePriceSnapshotsForDeal(secondDealSlug, snapshots);

      expect(writtenSnapshots).toEqual(snapshots);
      expect(await listPriceSnapshotsForDeal(secondDealSlug)).toEqual(snapshots);
    } finally {
      await prisma.priceSnapshot.deleteMany({
        where: {
          dealSlug: secondDealSlug,
        },
      });
    }
  });
});

describe("public deal price context for persisted deal store", () => {
  it("returns price snapshots for a deal loaded from the injected public deal store", async () => {
    const snapshots: PriceSnapshotRecord[] = [
      {
        label: "Launch deal",
        merchant: "Amazon AU",
        observedAt: "2026-04-22T00:00:00.000Z",
        price: "249.00",
      },
    ];
    const app = buildApp({
      publishedDealStore: {
        async getPublishedDeal(locale: string, slug: string) {
          if (locale !== "en" || slug !== "anker-power-station-for-a-249") {
            return null;
          }

          return {
            locale: "en",
            slug: "anker-power-station-for-a-249",
            title: "Anker power station for A$249",
            summary: "Portable power station deal with historical context.",
            category: "Outdoors",
          };
        },
        async hasPublishedDealSlug(slug: string) {
          return slug === "anker-power-station-for-a-249";
        },
      },
      priceSnapshotStore: {
        async listSnapshotsForDeal(dealSlug: string) {
          return dealSlug === "anker-power-station-for-a-249" ? snapshots : [];
        },
      },
    } as never);

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/public/deals/en/anker-power-station-for-a-249",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      locale: "en",
      slug: "anker-power-station-for-a-249",
      category: "Outdoors",
      priceContext: {
        snapshots,
      },
    });
  });
});
