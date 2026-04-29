import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import DealDiscoveryCard from "../../../../components/DealDiscoveryCard";
import RecentViewTracker from "../../../../components/RecentViewTracker";
import { getRelatedDeals } from "../../../../lib/discovery";
import { LocaleSwitch, PriceCard } from "../../../../lib/ui";
import { getPublicDealFromApi, listPriceSnapshots } from "../../../../lib/serverApi";
import {
  buildDealPageMetadata,
  buildLocaleHref,
  getLocaleCopy,
  getLocaleSwitchLinks,
  getPublicDeal,
  isSupportedLocale,
  mergePublicDeals,
  normalizeLivePublicDeal,
} from "../../../../lib/publicDeals";
import { resolveSessionTokens } from "../../../../lib/session";

interface DealDetailPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
  searchParams?: Promise<{
    favoriteStatus?: string | string[];
    sessionToken?: string | string[];
  }>;
}

type FavoriteStatus = "success" | "error";

const DEFAULT_SERVER_API_BASE_URL = "http://127.0.0.1:3001";

function buildServerApiUrl(path: string) {
  return new URL(path, process.env.API_BASE_URL ?? DEFAULT_SERVER_API_BASE_URL).toString();
}

function formatSnapshotPrice(price: string) {
  return price.startsWith("A$") ? price : `A$${price}`;
}

function formatObservedAt(observedAt: string) {
  return observedAt.slice(0, 10);
}

function toSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toFavoriteStatus(value: string | undefined): FavoriteStatus | null {
  return value === "success" || value === "error" ? value : null;
}

function getFavoriteActionCopy(locale: "en" | "zh", status: FavoriteStatus | null) {
  const copy =
    locale === "en"
      ? {
          title: "Save this deal",
          ctaLabel: "Add to Favorites",
          successMessage: "Added to favorites.",
          errorMessage: "Unable to add favorite.",
        }
      : {
          title: "保存此优惠",
          ctaLabel: "加入收藏",
          successMessage: "已加入收藏。",
          errorMessage: "收藏失败，请稍后再试。",
        };

  return {
    ...copy,
    feedbackMessage:
      status === "success" ? copy.successMessage : status === "error" ? copy.errorMessage : null,
  };
}

function buildFavoriteStatusRedirectTarget(
  locale: "en" | "zh",
  slug: string,
  status: FavoriteStatus,
) {
  const target = buildLocaleHref(locale, `/deals/${slug}`);
  const url = new URL(target, "http://local.test");
  url.searchParams.set("favoriteStatus", status);

  return `${url.pathname}${url.search}`;
}

async function submitFavorite(sessionToken: string | undefined, slug: string) {
  if (!sessionToken) {
    throw new Error("Session token is required.");
  }

  const response = await fetch(buildServerApiUrl("/v1/favorites"), {
    cache: "no-store",
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-session-token": sessionToken,
    },
    body: JSON.stringify({ dealId: slug }),
  });

  if (!response.ok) {
    throw new Error(`Favorites API request failed: ${response.status}`);
  }
}

export async function generateMetadata({
  params,
}: Pick<DealDetailPageProps, "params">): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  let deal = getPublicDeal(slug);
  if (!deal) {
    const liveDeal = await getPublicDealFromApi(locale, slug);
    deal = liveDeal ? normalizeLivePublicDeal(liveDeal, locale) : null;
  }

  if (!deal) {
    notFound();
  }

  return buildDealPageMetadata(locale, deal);
}

export default async function DealDetailPage({ params, searchParams }: DealDetailPageProps) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  let deal = getPublicDeal(slug);
  const liveApiDeal = deal ? null : await getPublicDealFromApi(activeLocale, slug);
  if (!deal && liveApiDeal) {
    deal = normalizeLivePublicDeal(liveApiDeal, activeLocale);
  }
  const copy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const { sessionToken } = await resolveSessionTokens(
    resolvedSearchParams?.sessionToken,
  );
  const favoriteStatus = toFavoriteStatus(
    toSingleSearchParam(resolvedSearchParams?.favoriteStatus),
  );

  if (!deal) {
    void copy;
    void buildLocaleHref;
    notFound();
  }

  let snapshots = liveApiDeal?.priceContext?.snapshots ?? [];
  let priceContextError: string | null = null;

  if (!liveApiDeal) {
    try {
      snapshots = await listPriceSnapshots(activeLocale, deal.slug);
    } catch {
      priceContextError =
        activeLocale === "en" ? "Price context unavailable." : "价格参考暂不可用。";
    }
  }

  const priceContextTitle = activeLocale === "en" ? "Price context" : "价格参考";
  const priceContextSummary =
    activeLocale === "en" ? "Selected price snapshots" : "历史价格快照";
  const relatedDeals = getRelatedDeals(deal.slug, { limit: 3 }, mergePublicDeals(deal ? [deal] : []));
  const relatedDealsTitle = activeLocale === "en" ? "Related deals" : "相关优惠";
  const relatedDealsSummary =
    activeLocale === "en" ? "More deals you may want to check." : "你可能还想看看这些优惠。";
  const detailCopy = deal.detail.locales[activeLocale];
  const favoriteActionCopy = getFavoriteActionCopy(activeLocale, favoriteStatus);
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";

  async function handleAddToFavorites() {
    "use server";

    let status: FavoriteStatus = "success";
    try {
      await submitFavorite(sessionToken, deal.slug);
    } catch {
      status = "error";
    }

    redirect(buildFavoriteStatusRedirectTarget(activeLocale, deal.slug, status));
  }

  return (
    <main className="web-detail-page">
      <RecentViewTracker slug={deal.slug} />
      <section className="web-detail-hero">
        <div className="web-detail-overview">
          <LocaleSwitch
            currentLocale={activeLocale}
            locales={getLocaleSwitchLinks(activeLocale, deal.slug)}
          />
          <div className="web-badge-row">
            <span className="web-chip">{deal.merchant.name}</span>
            <span className="web-chip web-chip--accent">{deal.currentPrice}</span>
            <span className="web-chip">{deal.discountLabel}</span>
          </div>
          <h1>{deal.locales[activeLocale].title}</h1>
          <p className="web-detail-summary">{deal.locales[activeLocale].summary}</p>
          <div className="web-note-grid">
            <section className="web-note-card" aria-labelledby="deal-merchant-title">
              <h2 id="deal-merchant-title">{copy.detailMerchantLabel}</h2>
              <p>{deal.merchant.name}</p>
            </section>
            <section className="web-note-card" aria-labelledby="deal-coupon-code-title">
              <h2 id="deal-coupon-code-title">{copy.detailCouponCodeLabel}</h2>
              <p>
                <code>{deal.detail.couponCode ?? copy.detailNoCouponCodeLabel}</code>
              </p>
            </section>
            <section className="web-note-card" aria-labelledby="deal-validity-title">
              <h2 id="deal-validity-title">{copy.detailValidityLabel}</h2>
              <p>{detailCopy.validity}</p>
            </section>
            <section className="web-note-card" aria-labelledby="deal-worth-title">
              <h2 id="deal-worth-title">{copy.detailWhyWorthItLabel}</h2>
              <p>{detailCopy.whyWorthIt}</p>
            </section>
          </div>
        </div>
        <aside className="web-detail-aside">
          <PriceCard
            currentPrice={deal.currentPrice}
            currentPriceLabel={copy.currentPriceLabel}
            originalPrice={deal.originalPrice !== deal.currentPrice ? deal.originalPrice : undefined}
            originalPriceLabel={
              deal.originalPrice !== deal.currentPrice ? copy.originalPriceLabel : undefined
            }
            discountLabel={deal.discountLabel}
            ctaLabel={copy.ctaLabel}
            ctaHref={deal.dealUrl}
          />
          <section aria-labelledby="favorite-action-title" className="web-status-panel">
        <h2 id="favorite-action-title">{favoriteActionCopy.title}</h2>
        {favoriteActionCopy.feedbackMessage ? (
          <p role="status">{favoriteActionCopy.feedbackMessage}</p>
        ) : null}
        <form action={handleAddToFavorites}>
          <button type="submit">{favoriteActionCopy.ctaLabel}</button>
        </form>
          </section>
        </aside>
      </section>
      <div className="web-detail-grid">
        <section aria-labelledby="deal-highlights-title" className="web-panel">
        <h2 id="deal-highlights-title">{copy.detailHighlightsLabel}</h2>
        <ul>
          {detailCopy.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </section>
        <section aria-labelledby="deal-how-to-get-it-title" className="web-panel">
        <h2 id="deal-how-to-get-it-title">{copy.detailHowToGetItLabel}</h2>
        <ol>
          {detailCopy.howToGetIt.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
        <section aria-labelledby="deal-terms-title" className="web-panel">
        <h2 id="deal-terms-title">{copy.detailTermsLabel}</h2>
        <ul>
          {detailCopy.termsAndWarnings.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </section>
      </div>
      {snapshots.length > 0 ? (
        <section aria-labelledby="price-context-title" className="web-panel web-panel--wide">
          <h2 id="price-context-title">{priceContextTitle}</h2>
          <p>{priceContextSummary}</p>
          <ul className="web-snapshot-list">
            {snapshots.map((snapshot) => (
              <li key={`${snapshot.label}-${snapshot.observedAt}`} className="web-snapshot-card">
                <p>{snapshot.label}</p>
                <p>{snapshot.merchant}</p>
                <p>{formatSnapshotPrice(snapshot.price)}</p>
                <p>{formatObservedAt(snapshot.observedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : priceContextError ? (
        <section className="web-panel">
          <p>{priceContextError}</p>
        </section>
      ) : null}
      {relatedDeals.length > 0 ? (
        <section aria-labelledby="related-deals-title" className="web-panel web-panel--wide">
          <h2 id="related-deals-title">{relatedDealsTitle}</h2>
          <p>{relatedDealsSummary}</p>
          <ul className="web-card-list web-card-list--split">
            {relatedDeals.map((relatedDeal) => (
              <li key={relatedDeal.slug}>
                <DealDiscoveryCard
                  deal={relatedDeal}
                  locale={activeLocale}
                  primaryActionLabel={copy.ctaLabel}
                  secondaryActionLabel={detailActionLabel}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
