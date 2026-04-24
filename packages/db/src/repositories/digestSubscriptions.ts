import { prisma } from "../client.ts";

export interface DigestSubscriptionRecord {
  categories: string[];
  frequency: string;
  locale: "en" | "zh";
}

export interface DailyDigestSubscriptionRecord extends DigestSubscriptionRecord {
  email: string;
  lastSentAt: string | null;
}

interface UpsertDigestSubscriptionInput {
  categories: string[];
  frequency: string;
  locale: string;
  email: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toDigestLocale(locale: string): "en" | "zh" {
  return locale === "zh" ? "zh" : "en";
}

export async function upsertDigestSubscription(
  input: UpsertDigestSubscriptionInput,
): Promise<DigestSubscriptionRecord> {
  const record = await prisma.emailDigestSubscription.upsert({
    where: {
      normalizedEmail: normalizeEmail(input.email),
    },
    create: {
      normalizedEmail: normalizeEmail(input.email),
      locale: input.locale,
      frequency: input.frequency,
      categories: input.categories,
    },
    update: {
      locale: input.locale,
      frequency: input.frequency,
      categories: input.categories,
    },
    select: {
      locale: true,
      frequency: true,
      categories: true,
    },
  });

  return {
    locale: toDigestLocale(record.locale),
    frequency: record.frequency,
    categories: record.categories,
  };
}

export async function getDigestSubscription(
  email: string,
): Promise<DigestSubscriptionRecord | null> {
  const record = await prisma.emailDigestSubscription.findUnique({
    where: {
      normalizedEmail: normalizeEmail(email),
    },
    select: {
      locale: true,
      frequency: true,
      categories: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    locale: toDigestLocale(record.locale),
    frequency: record.frequency,
    categories: record.categories,
  };
}

export async function listEligibleDailyDigestSubscriptions(
  now: Date,
): Promise<DailyDigestSubscriptionRecord[]> {
  const startOfDayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const rows = await prisma.emailDigestSubscription.findMany({
    where: {
      frequency: "daily",
      categories: {
        has: "deals",
      },
      OR: [
        {
          lastSentAt: null,
        },
        {
          lastSentAt: {
            lt: startOfDayUtc,
          },
        },
      ],
    },
    orderBy: {
      normalizedEmail: "asc",
    },
    select: {
      normalizedEmail: true,
      locale: true,
      frequency: true,
      categories: true,
      lastSentAt: true,
    },
  });

  return rows.map((row) => ({
    email: row.normalizedEmail,
    locale: toDigestLocale(row.locale),
    frequency: row.frequency,
    categories: row.categories,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
  }));
}

export async function markDigestSent(email: string, sentAt: Date): Promise<void> {
  await prisma.emailDigestSubscription.update({
    where: {
      normalizedEmail: normalizeEmail(email),
    },
    data: {
      lastSentAt: sentAt,
    },
  });
}
