import { prisma } from "../client.ts";

export interface DigestSubscriptionRecord {
  categories: string[];
  frequency: string;
  locale: string;
}

interface UpsertDigestSubscriptionInput extends DigestSubscriptionRecord {
  email: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertDigestSubscription(
  input: UpsertDigestSubscriptionInput,
): Promise<DigestSubscriptionRecord> {
  return prisma.emailDigestSubscription.upsert({
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
}

export async function getDigestSubscription(
  email: string,
): Promise<DigestSubscriptionRecord | null> {
  return prisma.emailDigestSubscription.findUnique({
    where: {
      normalizedEmail: normalizeEmail(email),
    },
    select: {
      locale: true,
      frequency: true,
      categories: true,
    },
  });
}
