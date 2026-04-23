import React from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import RecentViewTracker from "../../../../components/RecentViewTracker";
import { getRelatedDeals } from "../../../../lib/discovery";
import { LocaleSwitch, PriceCard } from "../../../../lib/ui";
import { listPriceSnapshots } from "../../../../lib/serverApi";
import {
  appendSessionToken,
  buildDealPageMetadata,
  buildLocaleHref,
  getLocaleCopy,
  getLocaleSwitchLinks,
  getPublicDeal,
  isSupportedLocale,
} from "../../../../lib/publicDeals";

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
  sessionToken: string | undefined,
  status: FavoriteStatus,
) {
  const target = appendSessionToken(buildLocaleHref(locale, `/deals/${slug}`), sessionToken);
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

  const deal = getPublicDeal(slug);
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
  const deal = getPublicDeal(slug);
  const copy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const sessionToken = toSingleSearchParam(resolvedSearchParams?.sessionToken);
  const favoriteStatus = toFavoriteStatus(
    toSingleSearchParam(resolvedSearchParams?.favoriteStatus),
  );

  if (!deal) {
    void copy;
    void buildLocaleHref;
    notFound();
  }

  let snapshots = [];
  let priceContextError: string | null = null;

  try {
    snapshots = await listPriceSnapshots(activeLocale, deal.slug);
  } catch {
    priceContextError =
      activeLocale === "en" ? "Price context unavailable." : "价格参考暂不可用。";
  }

  const priceContextTitle = activeLocale === "en" ? "Price context" : "价格参考";
  const priceContextSummary =
    activeLocale === "en" ? "Selected price snapshots" : "历史价格快照";
  const relatedDeals = getRelatedDeals(deal.slug, { limit: 3 });
  const relatedDealsTitle = activeLocale === "en" ? "Related deals" : "相关优惠";
  const relatedDealsSummary =
    activeLocale === "en" ? "More deals you may want to check." : "你可能还想看看这些优惠。";
  const detailCopy = deal.detail.locales[activeLocale];
  const favoriteActionCopy = getFavoriteActionCopy(activeLocale, favoriteStatus);

  async function handleAddToFavorites() {
    "use server";

    let status: FavoriteStatus = "success";
    try {
      await submitFavorite(sessionToken, deal.slug);
    } catch {
      status = "error";
    }

    redirect(buildFavoriteStatusRedirectTarget(activeLocale, deal.slug, sessionToken, status));
  }

  return (
    <main>
      <RecentViewTracker slug={deal.slug} />
      <LocaleSwitch
        currentLocale={activeLocale}
        locales={getLocaleSwitchLinks(activeLocale, deal.slug, sessionToken)}
      />
      <h1>{deal.locales[activeLocale].title}</h1>
      <p>{deal.locales[activeLocale].summary}</p>
      <PriceCard
        currentPrice={deal.currentPrice}
        currentPriceLabel={copy.currentPriceLabel}
        originalPrice={deal.originalPrice}
        originalPriceLabel={copy.originalPriceLabel}
        discountLabel={deal.discountLabel}
        ctaLabel={copy.ctaLabel}
        ctaHref={deal.dealUrl}
      />
      <section aria-labelledby="favorite-action-title">
        <h2 id="favorite-action-title">{favoriteActionCopy.title}</h2>
        {favoriteActionCopy.feedbackMessage ? (
          <p role="status">{favoriteActionCopy.feedbackMessage}</p>
        ) : null}
        <form action={handleAddToFavorites}>
          <button type="submit">{favoriteActionCopy.ctaLabel}</button>
        </form>
      </section>
      <section aria-labelledby="deal-merchant-title">
        <h2 id="deal-merchant-title">{copy.detailMerchantLabel}</h2>
        <p>{deal.merchant.name}</p>
      </section>
      <section aria-labelledby="deal-coupon-code-title">
        <h2 id="deal-coupon-code-title">{copy.detailCouponCodeLabel}</h2>
        <p>
          <code>{deal.detail.couponCode ?? copy.detailNoCouponCodeLabel}</code>
        </p>
      </section>
      <section aria-labelledby="deal-validity-title">
        <h2 id="deal-validity-title">{copy.detailValidityLabel}</h2>
        <p>{detailCopy.validity}</p>
      </section>
      <section aria-labelledby="deal-worth-title">
        <h2 id="deal-worth-title">{copy.detailWhyWorthItLabel}</h2>
        <p>{detailCopy.whyWorthIt}</p>
      </section>
      <section aria-labelledby="deal-highlights-title">
        <h2 id="deal-highlights-title">{copy.detailHighlightsLabel}</h2>
        <ul>
          {detailCopy.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="deal-how-to-get-it-title">
        <h2 id="deal-how-to-get-it-title">{copy.detailHowToGetItLabel}</h2>
        <ol>
          {detailCopy.howToGetIt.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="deal-terms-title">
        <h2 id="deal-terms-title">{copy.detailTermsLabel}</h2>
        <ul>
          {detailCopy.termsAndWarnings.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </section>
      {snapshots.length > 0 ? (
        <section aria-labelledby="price-context-title">
          <h2 id="price-context-title">{priceContextTitle}</h2>
          <p>{priceContextSummary}</p>
          <ul>
            {snapshots.map((snapshot) => (
              <li key={`${snapshot.label}-${snapshot.observedAt}`}>
                <p>{snapshot.label}</p>
                <p>{snapshot.merchant}</p>
                <p>{formatSnapshotPrice(snapshot.price)}</p>
                <p>{formatObservedAt(snapshot.observedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : priceContextError ? (
        <p>{priceContextError}</p>
      ) : null}
      {relatedDeals.length > 0 ? (
        <section aria-labelledby="related-deals-title">
          <h2 id="related-deals-title">{relatedDealsTitle}</h2>
          <p>{relatedDealsSummary}</p>
          <ul>
            {relatedDeals.map((relatedDeal) => (
              <li key={relatedDeal.slug}>
                <a
                  href={appendSessionToken(
                    buildLocaleHref(activeLocale, `/deals/${relatedDeal.slug}`),
                    sessionToken,
                  )}
                >
                  {relatedDeal.locales[activeLocale].title}
                </a>
                <p>{relatedDeal.locales[activeLocale].summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
