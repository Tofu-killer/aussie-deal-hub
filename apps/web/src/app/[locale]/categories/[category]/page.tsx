import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DealDiscoveryCard from "../../../../components/DealDiscoveryCard";
import { getCategoryDealGroups } from "../../../../lib/discovery";
import { listPublicDealsWithLocaleFallback } from "../../../../lib/serverApi";
import {
  PUBLIC_PRIMARY_CATEGORIES,
  appendQueryParams,
  buildCategoryMetadataPath,
  buildCategoryPageMetadata,
  buildPublicUrl,
  buildLocaleHref,
  getDiscoveryPublicDeals,
  getListingFilterQueryParams,
  getListingFiltersFromSearchParams,
  getLocaleCopy,
  getPublicCategoryTitle,
  hasActiveListingFilters,
  isSupportedLocale,
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

function getUnknownMerchantLabel(locale: SupportedLocale, merchantId: string) {
  return locale === "en"
    ? `Unknown merchant (${merchantId})`
    : `未知商家（${merchantId}）`;
}

function getMerchantOptions(
  locale: SupportedLocale,
  deals: PublicDealRecord[],
  activeMerchantId?: string,
) {
  const merchants = new Map<string, string>();

  for (const deal of deals) {
    if (!merchants.has(deal.merchant.id)) {
      merchants.set(deal.merchant.id, deal.merchant.name);
    }
  }

  if (activeMerchantId && !merchants.has(activeMerchantId)) {
    merchants.set(activeMerchantId, getUnknownMerchantLabel(locale, activeMerchantId));
  }

  return [...merchants.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function getMerchantName(
  locale: SupportedLocale,
  merchantId: string | undefined,
  deals: PublicDealRecord[],
) {
  if (!merchantId) {
    return null;
  }

  return (
    deals.find((deal) => deal.merchant.id === merchantId)?.merchant.name
    ?? getUnknownMerchantLabel(locale, merchantId)
  );
}

function getResultCountLabel(locale: SupportedLocale, count: number) {
  return locale === "en"
    ? `${count} published ${count === 1 ? "deal" : "deals"}`
    : `${count} 条已发布优惠`;
}

function getCategorySummary(
  locale: SupportedLocale,
  categoryTitle: string,
  hasFilters: boolean,
  merchantName: string | null,
  resultCount: number,
) {
  const resultCountLabel = getResultCountLabel(locale, resultCount);

  if (merchantName) {
    return locale === "en"
      ? `Showing ${resultCountLabel} from ${merchantName} in ${categoryTitle}.`
      : `展示 ${merchantName} 在${categoryTitle}中的 ${resultCountLabel}。`;
  }

  if (hasFilters) {
    return locale === "en"
      ? `Showing ${resultCountLabel} in ${categoryTitle} with active filters.`
      : `展示 ${categoryTitle}中符合当前筛选的 ${resultCountLabel}。`;
  }

  return locale === "en"
    ? "Filtered category lanes tuned for fast merchant jumps and in-site verification."
    : "按分类聚合优惠，主点击可直接前往商家页面，同时保留站内核对入口。";
}

function getCategoryMetadataTitle(
  locale: SupportedLocale,
  categoryTitle: string,
  merchantName: string | null,
) {
  if (!merchantName) {
    return `${categoryTitle} | Aussie Deal Hub`;
  }

  return locale === "en"
    ? `${merchantName} ${categoryTitle.toLowerCase()} | Aussie Deal Hub`
    : `${merchantName} ${categoryTitle} | Aussie Deal Hub`;
}

function getCategoryMetadataDescription(
  locale: SupportedLocale,
  categoryTitle: string,
  merchantName: string | null,
) {
  if (!merchantName) {
    return buildCategoryPageMetadata(locale, "deals").description;
  }

  return locale === "en"
    ? `Browse published ${categoryTitle.toLowerCase()} from ${merchantName} with merchant-aware filters and bilingual summaries.`
    : `浏览${merchantName}的已发布${categoryTitle}，并可继续按筛选收紧列表。`;
}

function getCategoryNoResultText(
  locale: SupportedLocale,
  categoryTitle: string,
  hasFilters: boolean,
  merchantName: string | null,
) {
  if (merchantName) {
    return locale === "en"
      ? `No published deals from ${merchantName} in ${categoryTitle} match the current filters.`
      : `当前筛选下没有找到 ${merchantName} 在${categoryTitle}中的已发布优惠。`;
  }

  if (hasFilters) {
    return locale === "en"
      ? `No published deals in ${categoryTitle} match the current filters.`
      : `当前筛选下没有找到 ${categoryTitle}中的已发布优惠。`;
  }

  return locale === "en" ? "No deals in this category yet." : "该分类暂无优惠。";
}

function getCategoryNote(
  locale: SupportedLocale,
  merchantName: string | null,
  hasFilters: boolean,
) {
  if (merchantName) {
    return locale === "en"
      ? "Merchant landing keeps this category scoped to one retailer while the sidebar narrows the list further."
      : "这是商家分类落地页，左侧筛选会继续收紧该商家在当前分类下的已发布优惠。";
  }

  if (hasFilters) {
    return locale === "en"
      ? "Primary clicks open the retailer page. Active filters stay visible while you refine the category lane."
      : "主点击直接打开商家商品页，当前筛选会保持可见，便于继续收紧这个分类列表。";
  }

  return locale === "en"
    ? "Use filters to compress the feed down to the most actionable price moves."
    : "使用筛选器压缩列表，只保留真正值得点开的价格变化。";
}

function getActiveFilterChips(
  locale: SupportedLocale,
  filters: ReturnType<typeof getListingFiltersFromSearchParams>,
  filterCopy: ReturnType<typeof getFilterCopy>,
  merchantName: string | null,
  resultCount: number,
) {
  const chips = [getResultCountLabel(locale, resultCount)];

  if (merchantName) {
    chips.push(locale === "en" ? `Merchant: ${merchantName}` : `商家：${merchantName}`);
  }

  if (filters.discountBand) {
    const discountLabel =
      filters.discountBand === "under-20"
        ? filterCopy.discountBandUnder20Label
        : filters.discountBand === "20-plus"
          ? filterCopy.discountBand20PlusLabel
          : filterCopy.discountBandFreeLabel;
    chips.push(locale === "en" ? `Discount: ${discountLabel}` : `折扣：${discountLabel}`);
  }

  if (filters.freeShipping) {
    chips.push(filterCopy.freeShippingLabel);
  }

  if (filters.endingSoon) {
    chips.push(filterCopy.endingSoonLabel);
  }

  if (filters.historicalLow) {
    chips.push(filterCopy.historicalLowLabel);
  }

  return chips;
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
  searchParams,
}: Pick<CategoryPageProps, "params" | "searchParams">): Promise<Metadata> {
  const { locale, category } = await params;

  if (!isSupportedLocale(locale) || !isPrimaryCategory(category)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const filters = getListingFiltersFromSearchParams(resolvedSearchParams);
  const liveDeals = (await listPublicDealsWithLocaleFallback(locale)).map((deal) =>
    normalizeLivePublicDeal(deal, locale),
  );
  const publicDeals = getDiscoveryPublicDeals(liveDeals);
  const merchantName = getMerchantName(locale, filters.merchant, publicDeals);
  const categoryTitle = getPublicCategoryTitle(locale, category);

  return {
    title: getCategoryMetadataTitle(locale, categoryTitle, merchantName),
    description: merchantName
      ? getCategoryMetadataDescription(locale, categoryTitle, merchantName)
      : buildCategoryPageMetadata(locale, category).description,
    alternates: {
      canonical: buildPublicUrl(buildCategoryMetadataPath(locale, category, filters)),
      languages: {
        en: buildPublicUrl(buildCategoryMetadataPath("en", category, filters)),
        zh: buildPublicUrl(buildCategoryMetadataPath("zh", category, filters)),
      },
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, category } = await params;
  if (!isSupportedLocale(locale) || !isPrimaryCategory(category)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const filters = getListingFiltersFromSearchParams(resolvedSearchParams);
  const hasFilters = hasActiveListingFilters(filters);
  const filterCopy = getFilterCopy(activeLocale);
  const liveDeals = (await listPublicDealsWithLocaleFallback(activeLocale)).map((deal) =>
    normalizeLivePublicDeal(deal, activeLocale),
  );
  const publicDeals = getDiscoveryPublicDeals(liveDeals);
  const merchantOptions = getMerchantOptions(activeLocale, publicDeals, filters.merchant);
  const categoryGroups = hasFilters
    ? getCategoryDealGroups(activeLocale, filters, publicDeals)
    : getCategoryDealGroups(activeLocale, undefined, publicDeals);
  const categoryGroup = categoryGroups.find(
    (group) => group.category === category,
  );
  const categoryDeals = categoryGroup?.deals ?? [];
  const categoryTitle = getPublicCategoryTitle(activeLocale, category);
  const merchantName = getMerchantName(activeLocale, filters.merchant, publicDeals);
  const heroSummary = getCategorySummary(
    activeLocale,
    categoryTitle,
    hasFilters,
    merchantName,
    categoryDeals.length,
  );
  const resultSummary = getCategoryNote(activeLocale, merchantName, hasFilters);
  const stateChips = hasFilters
    ? getActiveFilterChips(activeLocale, filters, filterCopy, merchantName, categoryDeals.length)
    : [];
  const emptyStateLabel = getCategoryNoResultText(
    activeLocale,
    categoryTitle,
    hasFilters,
    merchantName,
  );
  const categoryDealsTitle =
    activeLocale === "en" ? "Available deals" : "当前优惠";
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";
  const switchLinks = (["en", "zh"] as SupportedLocale[]).map((candidateLocale) => ({
    locale: candidateLocale,
    href: appendQueryParams(
      buildLocaleHref(candidateLocale, `/categories/${category}`),
      {
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
          <h1>{categoryTitle}</h1>
          <p className="web-page__summary">{heroSummary}</p>
        </div>
        <p className="web-page__note">{resultSummary}</p>
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
        <button type="submit">{filterCopy.submitLabel}</button>
      </form>
        </aside>
        <section
          aria-labelledby="category-deals-title"
          className="web-results-panel"
        >
          <div className="web-panel__header">
            <h2 id="category-deals-title">{categoryDealsTitle}</h2>
            {stateChips.length > 0 ? (
              <div
                className="web-badge-row"
                aria-label={activeLocale === "en" ? "Active category state" : "当前分类状态"}
              >
                {stateChips.map((chip) => (
                  <p className="web-query-chip" key={chip}>
                    {chip}
                  </p>
                ))}
              </div>
            ) : (
              <p>
                {activeLocale === "en"
                  ? "Primary actions open the merchant page. Secondary actions stay in-app."
                  : "主动作直达商家页，次级动作保留站内详情。"}
              </p>
            )}
          </div>
          {categoryDeals.length > 0 ? (
            <ul className="web-card-list web-card-list--split">
              {categoryDeals.map((deal) => (
                <li key={deal.slug}>
                  <DealDiscoveryCard
                    deal={deal}
                    locale={activeLocale}
                    primaryActionLabel={copy.ctaLabel}
                    secondaryActionLabel={detailActionLabel}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>{emptyStateLabel}</p>
          )}
        </section>
      </div>
    </main>
  );
}
