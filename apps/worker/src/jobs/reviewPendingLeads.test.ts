import { describe, expect, it } from "vitest";

import { reviewPendingLeads } from "./reviewPendingLeads";

describe("reviewPendingLeads", () => {
  it("returns reviewed payloads for pending leads only", () => {
    const reviewed = reviewPendingLeads(
      [
        {
          id: "lead_1",
          originalTitle: "Amazon AU: Nintendo Switch OLED for A$399 with code GAME20",
          snippet: "Coupon GAME20 expires tonight.",
          reviewStatus: "pending",
        },
        {
          id: "lead_2",
          originalTitle: "Target Nintendo Switch OLED A$399",
          snippet: "",
          reviewStatus: "reviewed",
        },
      ],
      {
        reviewedAt: "2026-04-22T08:00:00.000Z",
      },
    );

    expect(reviewed).toHaveLength(1);
    expect(reviewed[0]).toMatchObject({
      id: "lead_1",
      reviewStatus: "reviewed",
      reviewedAt: "2026-04-22T08:00:00.000Z",
      category: "Deals",
      aiConfidence: 88,
      riskLabels: [],
      localizedHints: ["en", "zh"],
      locales: {
        en: {
          title: "Nintendo Switch OLED for A$399 at Amazon AU",
          summary: "Coupon GAME20 expires tonight.",
        },
        zh: {
          title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
          summary: "优惠码 GAME20 今晚到期。",
        },
      },
    });
  });
});
