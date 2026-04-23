import React from "react";
import { notFound } from "next/navigation";

import { getCategoryDealGroups } from "../../../../lib/discovery";
import {
  PUBLIC_DEAL_CATEGORY_LABELS,
  appendQueryParams,
  appendSessionToken,
  buildLocaleHref,
  getSeededPublicDeals,
  getListingFilterQueryParams,
  getListingFiltersFromSearchParams,
  getLocaleCopy,
  hasActiveListingFilters,
  isSupportedLocale,
  type PublicDealCategory,
  type SupportedLocale,
} from "../../../../lib/publicDeals";
import { LocaleSwitch } from "../../../../lib/ui";

const PRIMARY_CATEGORIES: PublicDealCategory[] = [
  "deals",
  "historical-lows",
  "freebies",
  "gift-card-offers",
];

interface CategoryPageProps {
  params: Promise<{
    locale: string;
    category: string;
  }>;
  searchParams?: Promise<{
    "discount-band"?: string | string[];
    "ending-soon"?: string | string[];
    "free-shipping"?: string | string[];
    "historical-low"?: string | string[];
    merchant?: string | string[];
    sessionToken?: string | string[];
  }>;
}

function isPrimaryCategory(category: string): category is PublicDealCategory {
  return PRIMARY_CATEGORIES.includes(category as PublicDealCategory);
}

function getCategoryTitle(locale: SupportedLocale, label: string) {
  return locale === "en" ? label : `${label}优惠`;
}

function toSingleSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getMerchantOptions() {
  const merchants = new Map<string, string>();

  for (const deal of getSeededPublicDeals()) {
    if (!merchants.has(deal.merchant.id)) {
      merchants.set(deal.merchant.id, deal.merchant.name);
    }
  }

  return [...merchants.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getFilterCopy(locale: SupportedLocale) {
  return locale === "en"
    ? {
        merchantLabel: "Merchant",
        merchantAnyLabel: "All merchants",
        discountBandLabel: "Discount band",
        discountBandAnyLabel: "Any discount",
        discountBandUnder20Label: "Under 20%",
        discountBand20PlusLabel: "20% or more",
        discountBandFreeLabel: "Free",
        freeShippingLabel: "Free shipping only",
        endingSoonLabel: "Ending soon",
        historicalLowLabel: "Historical lows only",
        submitLabel: "Apply filters",
      }
    : {
        merchantLabel: "商家",
        merchantAnyLabel: "全部商家",
        discountBandLabel: "折扣区间",
        discountBandAnyLabel: "任意折扣",
        discountBandUnder20Label: "低于 20%",
        discountBand20PlusLabel: "20% 或更多",
        discountBandFreeLabel: "免费",
        freeShippingLabel: "仅免运费",
        endingSoonLabel: "即将结束",
        historicalLowLabel: "仅历史低价",
        submitLabel: "应用筛选",
      };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, category } = await params;
  if (!isSupportedLocale(locale) || !isPrimaryCategory(category)) {
    notFound();
  }

  const activeLocale = locale;
  const resolvedSearchParams = await searchParams;
  const sessionToken = toSingleSearchParam(resolvedSearchParams?.sessionToken) || undefined;
  const filters = getListingFiltersFromSearchParams(resolvedSearchParams);
  const hasFilters = hasActiveListingFilters(filters);
  const filterCopy = getFilterCopy(activeLocale);
  const merchantOptions = getMerchantOptions();
  const categoryGroups = hasFilters
    ? getCategoryDealGroups(activeLocale, filters)
    : getCategoryDealGroups(activeLocale);
  const categoryGroup = categoryGroups.find(
    (group) => group.category === category,
  );
  const categoryLabel = PUBLIC_DEAL_CATEGORY_LABELS[category][activeLocale];
  const categoryDeals = categoryGroup?.deals ?? [];
  const emptyStateLabel =
    activeLocale === "en" ? "No deals in this category yet." : "该分类暂无优惠。";
  const categoryDealsTitle =
    activeLocale === "en" ? "Available deals" : "当前优惠";
  const switchLinks = (["en", "zh"] as SupportedLocale[]).map((candidateLocale) => ({
    locale: candidateLocale,
    href: appendQueryParams(
      buildLocaleHref(candidateLocale, `/categories/${category}`),
      {
        sessionToken,
        ...getListingFilterQueryParams(filters),
      },
    ),
    label: getLocaleCopy(candidateLocale).localeLabels[candidateLocale],
  }));

  return (
    <main>
      <LocaleSwitch currentLocale={activeLocale} locales={switchLinks} />
      <h1>{getCategoryTitle(activeLocale, categoryLabel)}</h1>
      <form method="get" action={buildLocaleHref(activeLocale, `/categories/${category}`)}>
        <p>
          <label htmlFor="category-merchant">{filterCopy.merchantLabel}</label>
        </p>
        <select id="category-merchant" name="merchant" defaultValue={filters.merchant ?? ""}>
          <option value="">{filterCopy.merchantAnyLabel}</option>
          {merchantOptions.map((merchant) => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.name}
            </option>
          ))}
        </select>
        <p>
          <label htmlFor="category-discount-band">{filterCopy.discountBandLabel}</label>
        </p>
        <select
          id="category-discount-band"
          name="discount-band"
          defaultValue={filters.discountBand ?? ""}
        >
          <option value="">{filterCopy.discountBandAnyLabel}</option>
          <option value="under-20">{filterCopy.discountBandUnder20Label}</option>
          <option value="20-plus">{filterCopy.discountBand20PlusLabel}</option>
          <option value="free">{filterCopy.discountBandFreeLabel}</option>
        </select>
        <p>
          <label>
            <input
              name="free-shipping"
              type="checkbox"
              value="true"
              defaultChecked={filters.freeShipping}
            />
            {filterCopy.freeShippingLabel}
          </label>
        </p>
        <p>
          <label>
            <input
              name="ending-soon"
              type="checkbox"
              value="true"
              defaultChecked={filters.endingSoon}
            />
            {filterCopy.endingSoonLabel}
          </label>
        </p>
        <p>
          <label>
            <input
              name="historical-low"
              type="checkbox"
              value="true"
              defaultChecked={filters.historicalLow}
            />
            {filterCopy.historicalLowLabel}
          </label>
        </p>
        {sessionToken ? <input name="sessionToken" type="hidden" value={sessionToken} /> : null}
        <button type="submit">{filterCopy.submitLabel}</button>
      </form>
      {categoryDeals.length > 0 ? (
        <section aria-labelledby="category-deals-title">
          <h2 id="category-deals-title">{categoryDealsTitle}</h2>
          <ul>
            {categoryDeals.map((deal) => (
              <li key={deal.slug}>
                <a
                  href={appendSessionToken(
                    buildLocaleHref(activeLocale, `/deals/${deal.slug}`),
                    sessionToken,
                  )}
                >
                  {deal.locales[activeLocale].title}
                </a>
                <p>{deal.locales[activeLocale].summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p>{emptyStateLabel}</p>
      )}
    </main>
  );
}
