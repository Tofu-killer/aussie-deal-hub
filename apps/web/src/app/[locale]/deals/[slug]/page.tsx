import React from "react";
import { notFound } from "next/navigation";

import { LocaleSwitch, PriceCard } from "../../../../lib/ui";
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
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { locale, slug } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const deal = getPublicDeal(slug);
  const copy = getLocaleCopy(activeLocale);

  if (!deal) {
    void copy;
    void buildLocaleHref;
    notFound();
  }

  return (
    <main>
      <LocaleSwitch
        currentLocale={activeLocale}
        locales={getLocaleSwitchLinks(activeLocale, deal.slug)}
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
    </main>
  );
}
