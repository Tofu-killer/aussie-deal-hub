import { prisma } from "../client.ts";

export interface FavoriteRecord {
  dealId: string;
}

interface UpsertFavoriteInput {
  email: string;
  dealId: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertFavorite(input: UpsertFavoriteInput): Promise<FavoriteRecord> {
  const record = await prisma.favorite.upsert({
    where: {
      normalizedEmail_dealSlug: {
        normalizedEmail: normalizeEmail(input.email),
        dealSlug: input.dealId,
      },
    },
    create: {
      normalizedEmail: normalizeEmail(input.email),
      dealSlug: input.dealId,
    },
    update: {},
    select: {
      dealSlug: true,
    },
  });

  return {
    dealId: record.dealSlug,
  };
}

export async function deleteFavorite(input: UpsertFavoriteInput): Promise<void> {
  await prisma.favorite.deleteMany({
    where: {
      normalizedEmail: normalizeEmail(input.email),
      dealSlug: input.dealId,
    },
  });
}

export async function listFavoritesByEmail(email: string): Promise<FavoriteRecord[]> {
  const records = await prisma.favorite.findMany({
    where: {
      normalizedEmail: normalizeEmail(email),
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      dealSlug: true,
    },
  });

  return records.map((record) => ({
    dealId: record.dealSlug,
  }));
}
