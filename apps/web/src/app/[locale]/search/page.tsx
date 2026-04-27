import React from "react";
import { notFound } from "next/navigation";

import DealDiscoveryCard from "../../../components/DealDiscoveryCard";
import { searchDeals } from "../../../lib/discovery";
import { listPublicDeals } from "../../../lib/serverApi";
import {
  appendSessionToken,
  buildLocaleHref,
  getDefaultPublicDeals,
  getListingFiltersFromSearchParams,
  getLocaleCopy,
  hasActiveListingFilters,
  isSupportedLocale,
  mergePublicDeals,
  normalizeLivePublicDeal,
  type SupportedLocale,
  type PublicDealRecord,
} from "../../../lib/publicDeals";
import { resolveSessionTokens } from "../../../lib/session";

interface SearchPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    "discount-band"?: string | string[];
    "ending-soon"?: string | string[];
    "free-shipping"?: string | string[];
    "historical-low"?: string | string[];
    merchant?: string | string[];
    q?: string | string[];
    sessionToken?: string | string[];
  }>;
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

function normalizeSearchToken(value: string) {
  return value.trim().toLowerCase();
}

function getMerchantName(merchantId: string | undefined, deals: PublicDealRecord[]) {
  if (!merchantId) {
    return null;
  }

  return deals.find((deal) => deal.merchant.id === merchantId)?.merchant.name ?? null;
}

function getFilterCopy(locale: SupportedLocale) {
  return locale === "en"
    ? {
        queryLabel: "Search deals",
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
        queryLabel: "搜索优惠",
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

function getResultCountLabel(locale: SupportedLocale, count: number) {
  return locale === "en"
    ? `${count} published ${count === 1 ? "deal" : "deals"}`
    : `${count} 条已发布优惠`;
}

function getSearchSummary(
  locale: SupportedLocale,
  normalizedQuery: string,
  hasFilters: boolean,
  merchantName: string | null,
  resultCount: number,
) {
  const resultCountLabel = getResultCountLabel(locale, resultCount);
  const queryMatchesMerchant =
    merchantName !== null && normalizeSearchToken(normalizedQuery) === normalizeSearchToken(merchantName);

  if (merchantName && (!normalizedQuery || queryMatchesMerchant)) {
    return locale === "en"
      ? `Showing ${resultCountLabel} from ${merchantName}.`
      : `展示 ${merchantName} 的 ${resultCountLabel}。`;
  }

  if (merchantName && normalizedQuery) {
    return locale === "en"
      ? `Showing ${resultCountLabel} from ${merchantName} matching "${normalizedQuery}".`
      : `展示 ${merchantName} 中与“${normalizedQuery}”匹配的 ${resultCountLabel}。`;
  }

  if (normalizedQuery && hasFilters) {
    return locale === "en"
      ? `Showing ${resultCountLabel} for "${normalizedQuery}" with active filters.`
      : `展示与“${normalizedQuery}”匹配且符合当前筛选的 ${resultCountLabel}。`;
  }

  if (normalizedQuery) {
    return locale === "en"
      ? `Showing ${resultCountLabel} for "${normalizedQuery}".`
      : `展示与“${normalizedQuery}”匹配的 ${resultCountLabel}。`;
  }

  return locale === "en"
    ? `Showing ${resultCountLabel} with active filters.`
    : `展示符合当前筛选的 ${resultCountLabel}。`;
}

function getNoResultText(
  locale: SupportedLocale,
  normalizedQuery: string,
  hasFilters: boolean,
  merchantName: string | null,
) {
  const queryMatchesMerchant =
    merchantName !== null && normalizeSearchToken(normalizedQuery) === normalizeSearchToken(merchantName);

  if (merchantName && (!normalizedQuery || queryMatchesMerchant)) {
    return locale === "en"
      ? `No published deals found for ${merchantName} with the current filters.`
      : `当前筛选下没有找到 ${merchantName} 的已发布优惠。`;
  }

  if (merchantName && normalizedQuery) {
    return locale === "en"
      ? `No deals from ${merchantName} found for "${normalizedQuery}".`
      : `没有找到 ${merchantName} 中与“${normalizedQuery}”匹配的优惠。`;
  }

  if (normalizedQuery && hasFilters) {
    return locale === "en"
      ? `No deals found for "${normalizedQuery}" with the current filters.`
      : `没有找到与“${normalizedQuery}”匹配且符合当前筛选的优惠。`;
  }

  if (normalizedQuery) {
    return locale === "en"
      ? `No deals found for "${normalizedQuery}".`
      : `没有找到与“${normalizedQuery}”相关的优惠。`;
  }

  return locale === "en" ? "No deals match the current filters." : "没有找到符合当前筛选的优惠。";
}

function getSearchNote(
  locale: SupportedLocale,
  merchantName: string | null,
  hasFilters: boolean,
) {
  if (merchantName) {
    return locale === "en"
      ? "Merchant landing keeps this retailer's published deals visible while the sidebar narrows the list further."
      : "这是商家落地页，左侧筛选会继续收紧该商家的已发布优惠列表。";
  }

  if (hasFilters) {
    return locale === "en"
      ? "Primary clicks open the retailer page. Active filters stay visible while you refine the list."
      : "主点击直接打开商家商品页，当前筛选会保持可见，便于继续收窄列表。";
  }

  return locale === "en"
    ? "Primary clicks open the retailer page. Use the secondary action for on-site context."
    : "主点击直接打开商家商品页，次级动作保留站内详情解读。";
}

function getActiveFilterChips(
  locale: SupportedLocale,
  normalizedQuery: string,
  filters: ReturnType<typeof getListingFiltersFromSearchParams>,
  filterCopy: ReturnType<typeof getFilterCopy>,
  merchantName: string | null,
  resultCount: number,
) {
  const chips = [getResultCountLabel(locale, resultCount)];
  const queryMatchesMerchant =
    merchantName !== null && normalizeSearchToken(normalizedQuery) === normalizeSearchToken(merchantName);

  if (merchantName) {
    chips.push(locale === "en" ? `Merchant: ${merchantName}` : `商家：${merchantName}`);
  }

  if (normalizedQuery && !queryMatchesMerchant) {
    chips.push(locale === "en" ? `Keyword: ${normalizedQuery}` : `关键词：${normalizedQuery}`);
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

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const query = toSingleSearchParam(resolvedSearchParams?.q);
  const { urlSessionToken } = await resolveSessionTokens(resolvedSearchParams?.sessionToken);
  const filters = getListingFiltersFromSearchParams(resolvedSearchParams);
  const hasFilters = hasActiveListingFilters(filters);
  const normalizedQuery = query.trim();
  const filterCopy = getFilterCopy(activeLocale);
  const liveDeals = (await listPublicDeals(activeLocale)).map((deal) =>
    normalizeLivePublicDeal(deal, activeLocale),
  );
  const publicDeals = mergePublicDeals(liveDeals, getDefaultPublicDeals());
  const merchantOptions = getMerchantOptions(publicDeals);
  const merchantName = getMerchantName(filters.merchant, publicDeals);
  const hasSearchState = normalizedQuery.length > 0 || hasFilters;
  const results = hasSearchState
    ? searchDeals(normalizedQuery, activeLocale, hasFilters ? filters : undefined, publicDeals)
    : [];
  const searchSummary = hasSearchState
    ? getSearchSummary(activeLocale, normalizedQuery, hasFilters, merchantName, results.length)
    : activeLocale === "en"
      ? "Enter a keyword to start searching."
      : "请输入关键词开始搜索。";
  const noResultText = hasSearchState
    ? getNoResultText(activeLocale, normalizedQuery, hasFilters, merchantName)
    : activeLocale === "en"
      ? "Enter a keyword to start searching."
      : "请输入关键词开始搜索。";
  const resultSummary = getSearchNote(activeLocale, merchantName, hasFilters);
  const stateChips = hasSearchState
    ? getActiveFilterChips(
        activeLocale,
        normalizedQuery,
        filters,
        filterCopy,
        merchantName,
        results.length,
      )
    : [];

  const title = activeLocale === "en" ? "Search results" : "搜索结果";
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";

  return (
    <main className="web-page">
      <section className="web-page__hero">
        <div>
          <p className="web-kicker">{activeLocale === "en" ? "Discovery" : "搜索发现"}</p>
          <h1>{title}</h1>
          <p className="web-page__summary">{searchSummary}</p>
        </div>
        <p className="web-page__note">{resultSummary}</p>
      </section>
      <div className="web-page__content">
        <aside className="web-page__sidebar">
          <form className="web-filter-panel" method="get" action={buildLocaleHref(activeLocale, "/search")}>
        <p>
          <label htmlFor="search-query">{filterCopy.queryLabel}</label>
        </p>
        <input id="search-query" name="q" type="text" defaultValue={normalizedQuery} />
        <p>
          <label htmlFor="search-merchant">{filterCopy.merchantLabel}</label>
        </p>
        <select id="search-merchant" name="merchant" defaultValue={filters.merchant ?? ""}>
          <option value="">{filterCopy.merchantAnyLabel}</option>
          {merchantOptions.map((merchant) => (
            <option key={merchant.id} value={merchant.id}>
              {merchant.name}
            </option>
          ))}
        </select>
        <p>
          <label htmlFor="search-discount-band">{filterCopy.discountBandLabel}</label>
        </p>
        <select
          id="search-discount-band"
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
        {urlSessionToken ? <input name="sessionToken" type="hidden" value={urlSessionToken} /> : null}
        <button type="submit">{filterCopy.submitLabel}</button>
      </form>
        </aside>
        <section className="web-results-panel" aria-labelledby="search-results-heading">
          <div className="web-panel__header">
            <h2 id="search-results-heading">{title}</h2>
            {stateChips.length > 0 ? (
              <div className="web-badge-row" aria-label={activeLocale === "en" ? "Active search state" : "当前搜索状态"}>
                {stateChips.map((chip) => (
                  <p className="web-query-chip" key={chip}>
                    {chip}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
          {hasSearchState ? (
            results.length > 0 ? (
              <ul className="web-card-list web-card-list--split">
                {results.map((deal) => (
                  <li key={deal.slug}>
                    <DealDiscoveryCard
                      deal={deal}
                      locale={activeLocale}
                      primaryActionLabel={copy.ctaLabel}
                      secondaryActionLabel={detailActionLabel}
                      sessionToken={urlSessionToken}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p>{noResultText}</p>
            )
          ) : (
            <p>{searchSummary}</p>
          )}
        </section>
      </div>
      <a className="web-primary-link" href={appendSessionToken(buildLocaleHref(activeLocale, ""), urlSessionToken)}>
        {copy.backToHomeLabel}
      </a>
    </main>
  );
}
