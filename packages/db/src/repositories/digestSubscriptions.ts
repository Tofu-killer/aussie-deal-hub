import { prisma } from "../client.ts";

const WEEKLY_DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const supportedDigestCategories = [
  "deals",
  "historical-lows",
  "freebies",
  "gift-card-offers",
] as const;

export type DigestFrequency = "daily" | "weekly";

export interface DigestSubscriptionRecord {
  categories: string[];
  frequency: DigestFrequency;
  locale: "en" | "zh";
}

export interface EligibleDigestSubscriptionRecord extends DigestSubscriptionRecord {
  email: string;
  lastSentAt: string | null;
}

export type DailyDigestSubscriptionRecord = EligibleDigestSubscriptionRecord;

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

function toDigestFrequency(frequency: string): DigestFrequency {
  return frequency === "weekly" ? "weekly" : "daily";
}

function getStartOfUtcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
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
      locale: toDigestLocale(input.locale),
      frequency: toDigestFrequency(input.frequency),
      categories: input.categories,
    },
    update: {
      locale: toDigestLocale(input.locale),
      frequency: toDigestFrequency(input.frequency),
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
    frequency: toDigestFrequency(record.frequency),
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
    frequency: toDigestFrequency(record.frequency),
    categories: record.categories,
  };
}

export async function listEligibleDigestSubscriptions(
  now: Date,
): Promise<EligibleDigestSubscriptionRecord[]> {
  const startOfDayUtc = getStartOfUtcDay(now);
  const weeklyCutoff = new Date(now.getTime() - WEEKLY_DIGEST_INTERVAL_MS);
  const rows = await prisma.emailDigestSubscription.findMany({
    where: {
      categories: {
        hasSome: [...supportedDigestCategories],
      },
      OR: [
        {
          frequency: "daily",
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
        {
          frequency: "weekly",
          OR: [
            {
              lastSentAt: null,
            },
            {
              lastSentAt: {
                lte: weeklyCutoff,
              },
            },
          ],
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
    frequency: toDigestFrequency(row.frequency),
    categories: row.categories,
    lastSentAt: row.lastSentAt?.toISOString() ?? null,
  }));
}

export const listEligibleDailyDigestSubscriptions = listEligibleDigestSubscriptions;

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
