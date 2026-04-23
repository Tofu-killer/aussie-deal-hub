import { Router } from "express";
import {
  seededSelectedPriceSnapshots as defaultSelectedPriceSnapshots,
  selectedPriceSnapshotDealSlug,
} from "@aussie-deal-hub/db/repositories/priceSnapshots";

export interface PublicDealRecord {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
}

export interface PublicPriceSnapshotRecord {
  label: string;
  merchant: string;
  observedAt: string;
  price: string;
}

export interface PublishPublicDealLocaleInput {
  locale: string;
  slug: string;
  title: string;
  summary: string;
}

export interface PublishPublicDealInput {
  leadId: string;
  merchant: string;
  category: string;
  currentPrice: string;
  affiliateUrl: string;
  locales: PublishPublicDealLocaleInput[];
}

export interface PublishPublicDealResult {
  leadId: string;
  status: string;
  locales: Array<{
    locale: string;
    slug: string;
  }>;
}

export interface PublishedDealReader {
  getPublishedDeal(locale: string, slug: string): Promise<PublicDealRecord | null>;
  hasPublishedDealSlug(slug: string): Promise<boolean>;
}

export interface PublishedDealPublisher {
  publishDeal(input: PublishPublicDealInput): Promise<PublishPublicDealResult>;
}

export interface PublishedDealSlugLookup {
  getPublishedDealSlugForLead(leadId: string, locale: string): Promise<string | null>;
}

export type PublishedDealStore = PublishedDealReader & PublishedDealPublisher & PublishedDealSlugLookup;

export interface PriceSnapshotStore {
  listSnapshotsForDeal(dealSlug: string): Promise<PublicPriceSnapshotRecord[]>;
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

export function createSeedPublishedDealStore(
  store: Map<string, PublicDealRecord>,
): PublishedDealStore {
  const leadLocaleSlugs = new Map<string, string>();

  return {
    async getPublishedDeal(locale, slug) {
      return getPublishedDeal(store, locale, slug) ?? null;
    },
    async hasPublishedDealSlug(slug) {
      return getPublishedDealIds(store).has(slug);
    },
    async getPublishedDealSlugForLead(leadId, locale) {
      return leadLocaleSlugs.get(`${leadId}:${locale}`) ?? null;
    },
    async publishDeal(input) {
      for (const locale of input.locales) {
        store.set(`${locale.locale}:${locale.slug}`, {
          locale: locale.locale,
          slug: locale.slug,
          title: locale.title,
          summary: locale.summary,
          category: input.category,
        });
        leadLocaleSlugs.set(`${input.leadId}:${locale.locale}`, locale.slug);
      }

      return {
        leadId: input.leadId,
        status: "published",
        locales: input.locales.map((locale) => ({
          locale: locale.locale,
          slug: locale.slug,
        })),
      };
    },
  };
}

function createDefaultPriceSnapshotStore(): PriceSnapshotStore {
  return {
    async listSnapshotsForDeal(dealSlug: string) {
      return dealSlug === selectedPriceSnapshotDealSlug ? defaultSelectedPriceSnapshots : [];
    },
  };
}

export function createPublicDealsRouter(
  store: PublishedDealReader | Map<string, PublicDealRecord>,
  priceSnapshotStore: PriceSnapshotStore = createDefaultPriceSnapshotStore(),
) {
  const router = Router();
  const publishedDealStore = store instanceof Map ? createSeedPublishedDealStore(store) : store;

  router.get("/deals/:locale/:slug", async (request, response) => {
    const deal = await publishedDealStore.getPublishedDeal(
      request.params.locale ?? "",
      request.params.slug ?? "",
    );

    if (!deal) {
      response.status(404).json({ message: "Deal not found." });
      return;
    }

    const snapshots = await priceSnapshotStore.listSnapshotsForDeal(deal.slug);
    const priceContext = {
      snapshots,
    };

    response.json({
      ...deal,
      priceContext,
    });
  });

  return router;
}
