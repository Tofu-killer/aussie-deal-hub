import { prisma } from "../client.ts";

export interface PriceSnapshotRecord {
  label: string;
  merchant: string;
  observedAt: string;
  price: string;
}

export const selectedPriceSnapshotDealSlug = "nintendo-switch-oled-amazon-au";

export const seededSelectedPriceSnapshots: PriceSnapshotRecord[] = [
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

function assertSelectedDealSlug(dealSlug: string) {
  if (dealSlug !== selectedPriceSnapshotDealSlug) {
    throw new Error(`Price snapshots are only supported for ${selectedPriceSnapshotDealSlug}.`);
  }
}

function mapPriceSnapshotRecord(record: {
  label: string;
  merchant: string;
  observedAt: Date;
  price: { toFixed(fractionDigits?: number): string };
}): PriceSnapshotRecord {
  return {
    label: record.label,
    merchant: record.merchant,
    observedAt: record.observedAt.toISOString(),
    price: record.price.toFixed(2),
  };
}

export async function replacePriceSnapshotsForDeal(
  dealSlug: string,
  snapshots: PriceSnapshotRecord[],
): Promise<PriceSnapshotRecord[]> {
  assertSelectedDealSlug(dealSlug);

  return prisma.$transaction(async (tx) => {
    await tx.priceSnapshot.deleteMany({
      where: {
        dealSlug,
      },
    });

    if (snapshots.length > 0) {
      await tx.priceSnapshot.createMany({
        data: snapshots.map((snapshot) => ({
          dealSlug,
          label: snapshot.label,
          merchant: snapshot.merchant,
          price: snapshot.price,
          observedAt: new Date(snapshot.observedAt),
        })),
      });
    }

    const records = await tx.priceSnapshot.findMany({
      where: {
        dealSlug,
      },
      orderBy: [
        {
          observedAt: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
      select: {
        label: true,
        merchant: true,
        observedAt: true,
        price: true,
      },
    });

    return records.map(mapPriceSnapshotRecord);
  });
}

export async function listPriceSnapshotsForDeal(
  dealSlug: string,
): Promise<PriceSnapshotRecord[]> {
  assertSelectedDealSlug(dealSlug);

  const records = await prisma.priceSnapshot.findMany({
    where: {
      dealSlug,
    },
    orderBy: [
      {
        observedAt: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    select: {
      label: true,
      merchant: true,
      observedAt: true,
      price: true,
    },
  });

  return records.map(mapPriceSnapshotRecord);
}

export async function seedSelectedPriceSnapshots(): Promise<PriceSnapshotRecord[]> {
  const existingSnapshots = await listPriceSnapshotsForDeal(selectedPriceSnapshotDealSlug);

  if (
    existingSnapshots.length === seededSelectedPriceSnapshots.length &&
    JSON.stringify(existingSnapshots) === JSON.stringify(seededSelectedPriceSnapshots)
  ) {
    return existingSnapshots;
  }

  return replacePriceSnapshotsForDeal(
    selectedPriceSnapshotDealSlug,
    seededSelectedPriceSnapshots,
  );
}
