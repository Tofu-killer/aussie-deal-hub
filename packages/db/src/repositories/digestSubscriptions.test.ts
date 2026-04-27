import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock("../client.ts", () => ({
  prisma: {
    emailDigestSubscription: {
      findMany,
      upsert: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { listEligibleDigestSubscriptions } from "./digestSubscriptions";

describe("digestSubscriptions", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("lists due digest subscriptions for all supported categories across both cadences", async () => {
    const now = new Date("2026-04-29T08:00:00.000Z");

    findMany.mockResolvedValue([
      {
        normalizedEmail: "daily@example.com",
        locale: "en",
        frequency: "daily",
        categories: ["deals"],
        lastSentAt: null,
      },
      {
        normalizedEmail: "weekly@example.com",
        locale: "zh",
        frequency: "weekly",
        categories: ["freebies", "gift-card-offers"],
        lastSentAt: new Date("2026-04-22T08:00:00.000Z"),
      },
    ]);

    await expect(listEligibleDigestSubscriptions(now)).resolves.toEqual([
      {
        email: "daily@example.com",
        locale: "en",
        frequency: "daily",
        categories: ["deals"],
        lastSentAt: null,
      },
      {
        email: "weekly@example.com",
        locale: "zh",
        frequency: "weekly",
        categories: ["freebies", "gift-card-offers"],
        lastSentAt: "2026-04-22T08:00:00.000Z",
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        categories: {
          hasSome: ["deals", "historical-lows", "freebies", "gift-card-offers"],
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
                  lt: new Date("2026-04-29T00:00:00.000Z"),
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
                  lte: new Date("2026-04-22T08:00:00.000Z"),
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
  });
});
