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
  const results = normalizedQuery
    ? hasFilters
      ? searchDeals(normalizedQuery, activeLocale, filters, publicDeals)
      : searchDeals(normalizedQuery, activeLocale, undefined, publicDeals)
    : [];

  const title = activeLocale === "en" ? "Search results" : "搜索结果";
  const emptyPrompt =
    activeLocale === "en" ? "Enter a keyword to start searching." : "请输入关键词开始搜索。";
  const noResultText =
    activeLocale === "en"
      ? `No deals found for "${normalizedQuery}".`
      : `没有找到与“${normalizedQuery}”相关的优惠。`;
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";
  const resultSummary =
    activeLocale === "en"
      ? "Primary clicks open the retailer page. Use the secondary action for on-site context."
      : "主点击直接打开商家商品页，次级动作保留站内详情解读。";

  return (
    <main className="web-page">
      <section className="web-page__hero">
        <div>
          <p className="web-kicker">{activeLocale === "en" ? "Discovery" : "搜索发现"}</p>
          <h1>{title}</h1>
          <p className="web-page__summary">
            {normalizedQuery
              ? activeLocale === "en"
                ? `Showing published matches for "${normalizedQuery}".`
                : `展示与“${normalizedQuery}”匹配的已发布优惠。`
              : emptyPrompt}
          </p>
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
            {normalizedQuery ? <p className="web-query-chip">{normalizedQuery}</p> : null}
          </div>
          {normalizedQuery ? (
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
            <p>{emptyPrompt}</p>
          )}
        </section>
      </div>
      <a className="web-primary-link" href={appendSessionToken(buildLocaleHref(activeLocale, ""), urlSessionToken)}>
        {copy.backToHomeLabel}
      </a>
    </main>
  );
}
