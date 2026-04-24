import {
  PUBLIC_DEAL_CATEGORY_LABELS,
  getPublicDealDiscountBand,
  type PublicDealCategory,
  type PublicListingFilters,
  type PublicDealRecord,
  getPublicDeal,
  getDefaultPublicDeals,
  type SupportedLocale,
} from "./publicDeals";

export interface CategoryDealGroup {
  category: PublicDealCategory;
  deals: PublicDealRecord[];
  label: string;
}

interface RelatedDealsOptions {
  limit?: number;
}

function getSearchablePriceTokens(price: string): string[] {
  const normalizedPrice = price.trim();
  if (!normalizedPrice) {
    return [];
  }

  const numericPrice = normalizedPrice.replace(/[^0-9.]/g, "");
  return numericPrice && numericPrice !== normalizedPrice
    ? [normalizedPrice, numericPrice]
    : [normalizedPrice];
}

function buildSearchCorpus(deal: PublicDealRecord): string {
  const categoryLabels = deal.categories.flatMap((category) => [
    PUBLIC_DEAL_CATEGORY_LABELS[category].en,
    PUBLIC_DEAL_CATEGORY_LABELS[category].zh,
  ]);
  const localizedText = (["en", "zh"] as SupportedLocale[]).flatMap((locale) => [
    deal.locales[locale].title,
    deal.locales[locale].summary,
  ]);
  const merchantTokens = [deal.merchant.id, deal.merchant.name];
  const priceTokens = [
    ...getSearchablePriceTokens(deal.currentPrice),
    ...getSearchablePriceTokens(deal.originalPrice),
  ];

  return [
    deal.slug,
    deal.discountLabel,
    ...merchantTokens,
    ...priceTokens,
    ...deal.categories,
    ...categoryLabels,
    ...localizedText,
  ]
    .join(" ")
    .toLowerCase();
}

function toSearchToken(query: string) {
  return query.trim().toLowerCase();
}

function matchesListingFilters(deal: PublicDealRecord, filters?: PublicListingFilters) {
  if (!filters) {
    return true;
  }

  if (filters.merchant && deal.merchant.id.toLowerCase() !== filters.merchant) {
    return false;
  }

  if (filters.freeShipping && !deal.detail.freeShipping) {
    return false;
  }

  if (filters.endingSoon && !deal.detail.endingSoon) {
    return false;
  }

  if (filters.historicalLow && !deal.categories.includes("historical-lows")) {
    return false;
  }

  if (filters.discountBand && getPublicDealDiscountBand(deal) !== filters.discountBand) {
    return false;
  }

  return true;
}

export function getCategoryDealGroups(
  locale: SupportedLocale,
  filters?: PublicListingFilters,
  sourceDeals: PublicDealRecord[] = getDefaultPublicDeals(),
): CategoryDealGroup[] {
  const deals = sourceDeals.filter((deal) => matchesListingFilters(deal, filters));
  const grouped = new Map<PublicDealCategory, PublicDealRecord[]>();

  for (const deal of deals) {
    for (const category of deal.categories) {
      const existing = grouped.get(category);
      if (existing) {
        existing.push(deal);
      } else {
        grouped.set(category, [deal]);
      }
    }
  }

  return Array.from(grouped.entries())
    .map(([category, categoryDeals]) => ({
      category,
      deals: categoryDeals,
      label: PUBLIC_DEAL_CATEGORY_LABELS[category][locale],
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function searchDeals(
  query: string,
  _locale: SupportedLocale,
  filters?: PublicListingFilters,
  sourceDeals: PublicDealRecord[] = getDefaultPublicDeals(),
): PublicDealRecord[] {
  const token = toSearchToken(query);
  if (!token) {
    return [];
  }

  return sourceDeals.filter(
    (deal) => buildSearchCorpus(deal).includes(token) && matchesListingFilters(deal, filters),
  );
}

export function getRelatedDeals(
  slug: string,
  { limit = 3 }: RelatedDealsOptions = {},
  sourceDeals: PublicDealRecord[] = getDefaultPublicDeals(),
): PublicDealRecord[] {
  const sourceDeal = getPublicDeal(slug, sourceDeals);
  if (!sourceDeal) {
    return [];
  }

  const sourceCategories = new Set(sourceDeal.categories);
  const candidates = sourceDeals
    .filter((deal) => deal.slug !== sourceDeal.slug)
    .map((deal, index) => ({
      deal,
      index,
      sharedCategoryCount: deal.categories.filter((category) => sourceCategories.has(category))
        .length,
    }))
    .filter((candidate) => candidate.sharedCategoryCount > 0)
    .sort((left, right) => {
      if (right.sharedCategoryCount !== left.sharedCategoryCount) {
        return right.sharedCategoryCount - left.sharedCategoryCount;
      }

      return left.index - right.index;
    });

  return candidates.slice(0, Math.max(limit, 0)).map((candidate) => candidate.deal);
}
