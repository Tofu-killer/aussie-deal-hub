import { Router } from "express";

export interface PublicDealRecord {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
}

export function seedPublishedDeals() {
  return new Map<string, PublicDealRecord>([
    [
      "en:nintendo-switch-oled-amazon-au",
      {
        locale: "en",
        slug: "nintendo-switch-oled-amazon-au",
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
        summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
        category: "Deals",
      },
    ],
    [
      "zh:nintendo-switch-oled-amazon-au",
      {
        locale: "zh",
        slug: "nintendo-switch-oled-amazon-au",
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
        summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
        category: "Deals",
      },
    ],
  ]);
}

export function getPublishedDeal(
  store: Map<string, PublicDealRecord>,
  locale: string,
  slug: string,
) {
  return store.get(`${locale}:${slug}`);
}

export function getPublishedDealIds(store: Map<string, PublicDealRecord>) {
  return new Set(Array.from(store.values(), (deal) => deal.slug));
}

export function createPublicDealsRouter(store: Map<string, PublicDealRecord>) {
  const router = Router();

  router.get("/deals/:locale/:slug", (request, response) => {
    const deal = getPublishedDeal(
      store,
      request.params.locale ?? "",
      request.params.slug ?? "",
    );

    if (!deal) {
      response.status(404).json({ message: "Deal not found." });
      return;
    }

    response.json(deal);
  });

  return router;
}
