import React from "react";
import { notFound } from "next/navigation";

import { searchDeals } from "../../../lib/discovery";
import {
  appendSessionToken,
  buildLocaleHref,
  getSeededPublicDeals,
  getListingFiltersFromSearchParams,
  getLocaleCopy,
  hasActiveListingFilters,
  isSupportedLocale,
  type SupportedLocale,
} from "../../../lib/publicDeals";

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
  const sessionToken = toSingleSearchParam(resolvedSearchParams?.sessionToken) || undefined;
  const filters = getListingFiltersFromSearchParams(resolvedSearchParams);
  const hasFilters = hasActiveListingFilters(filters);
  const normalizedQuery = query.trim();
  const filterCopy = getFilterCopy(activeLocale);
  const merchantOptions = getMerchantOptions();
  const results = normalizedQuery
    ? hasFilters
      ? searchDeals(normalizedQuery, activeLocale, filters)
      : searchDeals(normalizedQuery, activeLocale)
    : [];

  const title = activeLocale === "en" ? "Search results" : "搜索结果";
  const emptyPrompt =
    activeLocale === "en" ? "Enter a keyword to start searching." : "请输入关键词开始搜索。";
  const noResultText =
    activeLocale === "en"
      ? `No deals found for "${normalizedQuery}".`
      : `没有找到与“${normalizedQuery}”相关的优惠。`;

  return (
    <main>
      <h1>{title}</h1>
      <form method="get" action={buildLocaleHref(activeLocale, "/search")}>
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
        {sessionToken ? <input name="sessionToken" type="hidden" value={sessionToken} /> : null}
        <button type="submit">{filterCopy.submitLabel}</button>
      </form>
      {normalizedQuery ? <p>{normalizedQuery}</p> : null}
      {normalizedQuery ? (
        results.length > 0 ? (
          <ul>
            {results.map((deal) => (
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
        ) : (
          <p>{noResultText}</p>
        )
      ) : (
        <p>{emptyPrompt}</p>
      )}
      <a href={appendSessionToken(buildLocaleHref(activeLocale, ""), sessionToken)}>
        {copy.backToHomeLabel}
      </a>
    </main>
  );
}
