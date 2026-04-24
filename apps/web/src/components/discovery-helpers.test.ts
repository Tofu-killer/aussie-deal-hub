import { describe, expect, it } from "vitest";

import {
  getCategoryDealGroups,
  getRelatedDeals,
  searchDeals,
} from "../lib/discovery";

describe("discovery helpers", () => {
  it("groups deals by category with localized labels", () => {
    const zhGroups = getCategoryDealGroups("zh");
    const dealsGroup = zhGroups.find((group) => group.category === "deals");

    expect(dealsGroup).toBeDefined();
    expect(dealsGroup?.label).toBe("优惠");
    expect(dealsGroup?.deals.map((deal) => deal.slug)).toContain(
      "nintendo-switch-oled-amazon-au",
    );
  });

  it("matches search queries across bilingual deal content and category labels", () => {
    expect(searchDeals("AirPods", "en").map((deal) => deal.slug)).toContain(
      "airpods-pro-2-costco-au",
    );
    expect(searchDeals("礼品卡", "zh").map((deal) => deal.slug)).toContain(
      "coles-gift-card-bonus-credit",
    );
    expect(searchDeals("免费", "zh").map((deal) => deal.slug)).toContain("epic-game-freebie-week");
  });

  it("matches seeded deals by merchant name and merchant id", () => {
    expect(searchDeals("Epic Games Store", "en").map((deal) => deal.slug)).toContain(
      "epic-game-freebie-week",
    );
    expect(searchDeals("epic-games-store", "en").map((deal) => deal.slug)).toContain(
      "epic-game-freebie-week",
    );
  });

  it("only returns related deals that share a primary category, or empty when none match", () => {
    const relatedToSwitch = getRelatedDeals("nintendo-switch-oled-amazon-au", { limit: 3 });
    const relatedSlugs = relatedToSwitch.map((deal) => deal.slug);

    expect(relatedSlugs).not.toContain("nintendo-switch-oled-amazon-au");
    expect(relatedSlugs).toContain("airpods-pro-2-costco-au");
    expect(relatedSlugs).not.toContain("epic-game-freebie-week");
    expect(relatedSlugs).not.toContain("coles-gift-card-bonus-credit");
    expect(getRelatedDeals("coles-gift-card-bonus-credit")).toEqual([]);
  });

  it("does not fall back to seeded deals when production runtime disables them", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSeededFlag = process.env.PUBLIC_SEEDED_DEALS_ENABLED;

    process.env.NODE_ENV = "production";
    process.env.PUBLIC_SEEDED_DEALS_ENABLED = "0";

    try {
      expect(searchDeals("AirPods", "en")).toEqual([]);
      expect(getCategoryDealGroups("en")).toEqual([]);
      expect(getRelatedDeals("nintendo-switch-oled-amazon-au")).toEqual([]);
    } finally {
      if (previousNodeEnv) {
        process.env.NODE_ENV = previousNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }

      if (previousSeededFlag) {
        process.env.PUBLIC_SEEDED_DEALS_ENABLED = previousSeededFlag;
      } else {
        delete process.env.PUBLIC_SEEDED_DEALS_ENABLED;
      }
    }
  });
});
