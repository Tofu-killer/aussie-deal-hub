import { describe, expect, it, vi } from "vitest";

import { sendDailyDigests } from "./sendDailyDigests";

describe("sendDailyDigests", () => {
  it("sends one localized digest to each eligible subscriber and marks it sent", async () => {
    const sendDigest = vi.fn().mockResolvedValue(undefined);
    const markSent = vi.fn().mockResolvedValue(undefined);
    const sentAt = new Date("2026-04-26T08:00:00.000Z");

    const summary = await sendDailyDigests(
      {
        async listEligibleSubscriptions() {
          return [
            {
              email: "shopper@example.com",
              locale: "zh",
              frequency: "daily",
              categories: ["deals"],
              lastSentAt: null,
            },
          ];
        },
        markSent,
      },
      {
        async listByEmail(email) {
          expect(email).toBe("shopper@example.com");

          return [
            { dealId: "switch-en" },
            { dealId: "missing-deal" },
          ];
        },
      },
      {
        async listDigestDeals() {
          return [
            {
              id: "deal_switch",
              merchant: "Amazon AU",
              status: "published",
              locales: {
                en: {
                  slug: "switch-en",
                  title: "Nintendo Switch OLED for A$399 at Amazon AU",
                  merchant: "Amazon AU",
                },
                zh: {
                  slug: "switch-zh",
                  title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
                  merchant: "亚马逊澳洲",
                },
              },
            },
          ];
        },
      },
      {
        sendDigest,
      },
      {
        now: sentAt,
      },
    );

    expect(sendDigest).toHaveBeenCalledWith({
      email: "shopper@example.com",
      locale: "zh",
      subject: "每日捡漏摘要",
      html: expect.stringContaining("亚马逊澳洲"),
      deals: [
        {
          id: "switch-zh",
          merchant: "亚马逊澳洲",
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
        },
      ],
    });
    expect(markSent).toHaveBeenCalledWith("shopper@example.com", sentAt);
    expect(summary).toEqual({
      sentCount: 1,
      skippedCount: 0,
      sentEmails: ["shopper@example.com"],
    });
  });

  it("skips subscriptions already sent today or without live favorite deals", async () => {
    const sendDigest = vi.fn();
    const markSent = vi.fn();

    const summary = await sendDailyDigests(
      {
        async listEligibleSubscriptions() {
          return [
            {
              email: "stale@example.com",
              locale: "en",
              frequency: "daily",
              categories: ["deals"],
              lastSentAt: "2026-04-26T00:10:00.000Z",
            },
            {
              email: "empty@example.com",
              locale: "en",
              frequency: "daily",
              categories: ["deals"],
              lastSentAt: null,
            },
          ];
        },
        markSent,
      },
      {
        async listByEmail(email) {
          if (email === "empty@example.com") {
            return [{ dealId: "missing-deal" }];
          }

          return [{ dealId: "switch-en" }];
        },
      },
      {
        async listDigestDeals() {
          return [
            {
              id: "deal_switch",
              merchant: "Amazon AU",
              status: "published",
              locales: {
                en: {
                  slug: "switch-en",
                  title: "Nintendo Switch OLED for A$399 at Amazon AU",
                  merchant: "Amazon AU",
                },
                zh: {
                  slug: "switch-zh",
                  title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
                  merchant: "亚马逊澳洲",
                },
              },
            },
          ];
        },
      },
      {
        sendDigest,
      },
      {
        now: new Date("2026-04-26T08:00:00.000Z"),
      },
    );

    expect(sendDigest).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
    expect(summary).toEqual({
      sentCount: 0,
      skippedCount: 2,
      sentEmails: [],
    });
  });

  it("sends weekly digests once seven days have elapsed and uses weekly copy", async () => {
    const sendDigest = vi.fn().mockResolvedValue(undefined);
    const markSent = vi.fn().mockResolvedValue(undefined);
    const sentAt = new Date("2026-04-29T08:00:00.000Z");

    const summary = await sendDailyDigests(
      {
        async listEligibleSubscriptions() {
          return [
            {
              email: "weekly@example.com",
              locale: "en",
              frequency: "weekly",
              categories: ["deals"],
              lastSentAt: "2026-04-22T08:00:00.000Z",
            },
          ];
        },
        markSent,
      },
      {
        async listByEmail(email) {
          expect(email).toBe("weekly@example.com");

          return [{ dealId: "switch-en" }];
        },
      },
      {
        async listDigestDeals() {
          return [
            {
              id: "deal_switch",
              merchant: "Amazon AU",
              status: "published",
              locales: {
                en: {
                  slug: "switch-en",
                  title: "Nintendo Switch OLED for A$399 at Amazon AU",
                  merchant: "Amazon AU",
                },
                zh: {
                  slug: "switch-zh",
                  title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
                  merchant: "亚马逊澳洲",
                },
              },
            },
          ];
        },
      },
      {
        sendDigest,
      },
      {
        now: sentAt,
      },
    );

    expect(sendDigest).toHaveBeenCalledWith({
      email: "weekly@example.com",
      locale: "en",
      subject: "Weekly Deals Digest",
      html: expect.stringContaining("This Week&apos;s Picks"),
      deals: [
        {
          id: "switch-en",
          merchant: "Amazon AU",
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
        },
      ],
    });
    expect(markSent).toHaveBeenCalledWith("weekly@example.com", sentAt);
    expect(summary).toEqual({
      sentCount: 1,
      skippedCount: 0,
      sentEmails: ["weekly@example.com"],
    });
  });

  it("skips weekly subscriptions sent within the last seven days", async () => {
    const sendDigest = vi.fn();
    const markSent = vi.fn();

    const summary = await sendDailyDigests(
      {
        async listEligibleSubscriptions() {
          return [
            {
              email: "weekly@example.com",
              locale: "en",
              frequency: "weekly",
              categories: ["deals"],
              lastSentAt: "2026-04-23T08:00:00.000Z",
            },
          ];
        },
        markSent,
      },
      {
        async listByEmail() {
          return [{ dealId: "switch-en" }];
        },
      },
      {
        async listDigestDeals() {
          return [
            {
              id: "deal_switch",
              merchant: "Amazon AU",
              status: "published",
              locales: {
                en: {
                  slug: "switch-en",
                  title: "Nintendo Switch OLED for A$399 at Amazon AU",
                  merchant: "Amazon AU",
                },
                zh: {
                  slug: "switch-zh",
                  title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
                  merchant: "亚马逊澳洲",
                },
              },
            },
          ];
        },
      },
      {
        sendDigest,
      },
      {
        now: new Date("2026-04-29T08:00:00.000Z"),
      },
    );

    expect(sendDigest).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
    expect(summary).toEqual({
      sentCount: 0,
      skippedCount: 1,
      sentEmails: [],
    });
  });
});
