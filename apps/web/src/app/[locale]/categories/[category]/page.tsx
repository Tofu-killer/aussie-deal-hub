import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DealDiscoveryCard from "../../../../components/DealDiscoveryCard";
import { getCategoryDealGroups } from "../../../../lib/discovery";
import { listPublicDeals } from "../../../../lib/serverApi";
import {
  PUBLIC_PRIMARY_CATEGORIES,
  appendQueryParams,
  appendSessionToken,
  buildCategoryPageMetadata,
  buildLocaleHref,
  getSeededPublicDeals,
  getListingFilterQueryParams,
  getListingFiltersFromSearchParams,
  getLocaleCopy,
  getPublicCategoryTitle,
  hasActiveListingFilters,
  isSupportedLocale,
  mergePublicDeals,
  normalizeLivePublicDeal,
  type PublicDealCategory,
  type PublicDealRecord,
  type SupportedLocale,
} from "../../../../lib/publicDeals";
import { LocaleSwitch } from "../../../../lib/ui";

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
  return PUBLIC_PRIMARY_CATEGORIES.includes(category as PublicDealCategory);
}

function toSingleSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getMerchantOptions(deals: PublicDealRecord[]) {
  const merchants = new Map<string, string>();

  for (const deal of deals) {
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

export async function generateMetadata({
  params,
}: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { locale, category } = await params;

  if (!isSupportedLocale(locale) || !isPrimaryCategory(category)) {
    notFound();
  }

  return buildCategoryPageMetadata(locale, category);
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
  const liveDeals = (await listPublicDeals(activeLocale)).map((deal) =>
    normalizeLivePublicDeal(deal, activeLocale),
  );
  const publicDeals = mergePublicDeals(liveDeals, getSeededPublicDeals());
  const merchantOptions = getMerchantOptions(publicDeals);
  const categoryGroups = hasFilters
    ? getCategoryDealGroups(activeLocale, filters, publicDeals)
    : getCategoryDealGroups(activeLocale, undefined, publicDeals);
  const categoryGroup = categoryGroups.find(
    (group) => group.category === category,
  );
  const categoryDeals = categoryGroup?.deals ?? [];
  const emptyStateLabel =
    activeLocale === "en" ? "No deals in this category yet." : "该分类暂无优惠。";
  const categoryDealsTitle =
    activeLocale === "en" ? "Available deals" : "当前优惠";
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";
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
    <main className="web-page">
      <section className="web-page__hero">
        <div>
          <LocaleSwitch currentLocale={activeLocale} locales={switchLinks} />
          <p className="web-kicker">{activeLocale === "en" ? "Category view" : "分类浏览"}</p>
          <h1>{getPublicCategoryTitle(activeLocale, category)}</h1>
          <p className="web-page__summary">
            {activeLocale === "en"
              ? "Filtered category lanes tuned for fast merchant jumps and in-site verification."
              : "按分类聚合优惠，主点击可直接前往商家页面，同时保留站内核对入口。"}
          </p>
        </div>
        <p className="web-page__note">
          {activeLocale === "en"
            ? "Use filters to compress the feed down to the most actionable price moves."
            : "使用筛选器压缩列表，只保留真正值得点开的价格变化。"}
        </p>
      </section>
      <div className="web-page__content">
        <aside className="web-page__sidebar">
          <form className="web-filter-panel" method="get" action={buildLocaleHref(activeLocale, `/categories/${category}`)}>
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
        </aside>
        {categoryDeals.length > 0 ? (
          <section aria-labelledby="category-deals-title" className="web-results-panel">
            <div className="web-panel__header">
              <h2 id="category-deals-title">{categoryDealsTitle}</h2>
              <p>
                {activeLocale === "en"
                  ? "Primary actions open the merchant page. Secondary actions stay in-app."
                  : "主动作直达商家页，次级动作保留站内详情。"}
              </p>
            </div>
            <ul className="web-card-list web-card-list--split">
              {categoryDeals.map((deal) => (
                <li key={deal.slug}>
                  <DealDiscoveryCard
                    deal={deal}
                    locale={activeLocale}
                    primaryActionLabel={getLocaleCopy(activeLocale).ctaLabel}
                    secondaryActionLabel={detailActionLabel}
                    sessionToken={sessionToken}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="web-results-panel">
            <p>{emptyStateLabel}</p>
          </section>
        )}
      </div>
    </main>
  );
}
