import React from "react";
import { notFound } from "next/navigation";

import { LocaleSwitch, PriceCard } from "../../../../lib/ui";
import { listPriceSnapshots } from "../../../../lib/serverApi";
import {
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
    sessionToken?: string | string[];
  }>;
}

function formatSnapshotPrice(price: string) {
  return price.startsWith("A$") ? price : `A$${price}`;
}

function formatObservedAt(observedAt: string) {
  return observedAt.slice(0, 10);
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
  const sessionToken = Array.isArray(resolvedSearchParams?.sessionToken)
    ? resolvedSearchParams.sessionToken[0]
    : resolvedSearchParams?.sessionToken;

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

  return (
    <main>
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
    </main>
  );
}
