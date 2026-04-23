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
  merchant?: string;
  currentPrice?: string;
  affiliateUrl?: string;
  publishedAt?: string;
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

export interface PublishedDealListReader {
  listPublishedDeals(locale: string): Promise<PublicDealRecord[]>;
}

export interface PublishedDealPublisher {
  publishDeal(input: PublishPublicDealInput): Promise<PublishPublicDealResult>;
}

export interface PublishedDealSlugLookup {
  getPublishedDealSlugForLead(leadId: string, locale: string): Promise<string | null>;
}

export type PublishedDealStore = PublishedDealReader &
  PublishedDealListReader &
  PublishedDealPublisher &
  PublishedDealSlugLookup;

export interface PriceSnapshotStore {
  listSnapshotsForDeal(dealSlug: string): Promise<PublicPriceSnapshotRecord[]>;
}

const defaultPublishedAt = "1970-01-01T00:00:00.000Z";
const seededDealMetadata = {
  merchant: "Amazon AU",
  currentPrice: "399.00",
  affiliateUrl: "https://www.amazon.com.au/deal",
  publishedAt: "2025-04-15T00:00:00.000Z",
};

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
        ...seededDealMetadata,
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
        ...seededDealMetadata,
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

function withPublicDealDefaults(deal: PublicDealRecord): PublicDealRecord {
  return {
    ...deal,
    merchant: deal.merchant ?? "Unknown merchant",
    currentPrice: deal.currentPrice ?? "0.00",
    affiliateUrl: deal.affiliateUrl ?? "",
    publishedAt: deal.publishedAt ?? defaultPublishedAt,
  };
}

function comparePublicDeals(left: PublicDealRecord, right: PublicDealRecord) {
  const publishedAtDiff = (right.publishedAt ?? defaultPublishedAt).localeCompare(
    left.publishedAt ?? defaultPublishedAt,
  );

  if (publishedAtDiff !== 0) {
    return publishedAtDiff;
  }

  return left.slug.localeCompare(right.slug);
}

export function listPublishedDeals(store: Map<string, PublicDealRecord>, locale: string) {
  return Array.from(store.values())
    .filter((deal) => deal.locale === locale)
    .map(withPublicDealDefaults)
    .sort(comparePublicDeals);
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
    async listPublishedDeals(locale) {
      return listPublishedDeals(store, locale);
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
          merchant: input.merchant,
          currentPrice: input.currentPrice,
          affiliateUrl: input.affiliateUrl,
          publishedAt: defaultPublishedAt,
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
  store: (PublishedDealReader & Partial<PublishedDealListReader>) | Map<string, PublicDealRecord>,
  priceSnapshotStore: PriceSnapshotStore = createDefaultPriceSnapshotStore(),
) {
  const router = Router();
  const publishedDealStore = store instanceof Map ? createSeedPublishedDealStore(store) : store;

  router.get("/deals/:locale", async (request, response) => {
    if (!publishedDealStore.listPublishedDeals) {
      response.status(503).json({ message: "Published deal list store is not configured." });
      return;
    }

    const items = await publishedDealStore.listPublishedDeals(request.params.locale ?? "");

    response.json({
      items: items.map(withPublicDealDefaults),
    });
  });

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
      ...withPublicDealDefaults(deal),
      priceContext,
    });
  });

  return router;
}
