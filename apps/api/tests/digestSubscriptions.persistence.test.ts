import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import {
  listEligibleDigestSubscriptions,
  markDigestSent,
  upsertDigestSubscription,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("digest subscription persistence", () => {
  it("lists due daily deals subscriptions and excludes them after marking sent", async () => {
    const email = `digest.${randomUUID()}@example.com`;
    const now = new Date("2026-04-26T08:00:00.000Z");

    try {
      await upsertDigestSubscription({
        email,
        locale: "en",
        frequency: "daily",
        categories: ["deals"],
      });

      const dueBeforeSend = await listEligibleDigestSubscriptions(now);

      expect(dueBeforeSend).toContainEqual({
        email,
        locale: "en",
        frequency: "daily",
        categories: ["deals"],
        lastSentAt: null,
      });

      await markDigestSent(email, now);

      const dueAfterSend = await listEligibleDigestSubscriptions(now);

      expect(dueAfterSend.find((subscription) => subscription.email === email)).toBeUndefined();
    } finally {
      await prisma.emailDigestSubscription.deleteMany({
        where: {
          normalizedEmail: email,
        },
      });
    }
  });

  it("lists due weekly deals subscriptions only after seven days have elapsed", async () => {
    const email = `digest.weekly.${randomUUID()}@example.com`;
    const now = new Date("2026-04-29T08:00:00.000Z");

    try {
      await upsertDigestSubscription({
        email,
        locale: "zh",
        frequency: "weekly",
        categories: ["deals"],
      });
      await markDigestSent(email, new Date("2026-04-23T08:00:00.000Z"));

      const tooSoon = await listEligibleDigestSubscriptions(now);
      expect(tooSoon.find((subscription) => subscription.email === email)).toBeUndefined();

      await markDigestSent(email, new Date("2026-04-22T08:00:00.000Z"));

      const dueAfterSevenDays = await listEligibleDigestSubscriptions(now);
      expect(dueAfterSevenDays).toContainEqual({
        email,
        locale: "zh",
        frequency: "weekly",
        categories: ["deals"],
        lastSentAt: "2026-04-22T08:00:00.000Z",
      });
    } finally {
      await prisma.emailDigestSubscription.deleteMany({
        where: {
          normalizedEmail: email,
        },
      });
    }
  });
});
