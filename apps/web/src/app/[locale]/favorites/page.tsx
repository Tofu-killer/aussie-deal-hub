import React from "react";
import { notFound } from "next/navigation";

import { appendSessionToken, buildLocaleHref, getLocaleCopy, getPublicDeal, isSupportedLocale } from "../../../lib/publicDeals";
import { listFavoriteDealIds } from "../../../lib/serverApi";

interface FavoritesPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    sessionToken?: string | string[];
  }>;
}

export default async function FavoritesPage({ params, searchParams }: FavoritesPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const sessionToken = Array.isArray(resolvedSearchParams?.sessionToken)
    ? resolvedSearchParams.sessionToken[0]
    : resolvedSearchParams?.sessionToken;
  let favoriteDeals = [] as Array<NonNullable<ReturnType<typeof getPublicDeal>>>;
  let favoritesError: string | null = null;

  try {
    favoriteDeals = (await listFavoriteDealIds(sessionToken))
      .map((favorite) => getPublicDeal(favorite.dealId))
      .filter((deal) => deal !== null);
  } catch {
    favoritesError = activeLocale === "en" ? "Unable to load favorites." : "无法加载收藏。";
  }
  const savedDealsLabel = activeLocale === "en" ? "Saved deals" : "已保存优惠";
  const emptyStateLabel = activeLocale === "en" ? "No favorites saved yet." : "还没有保存的收藏。";

  return (
    <main>
      <h1>{copy.favoritesTitle}</h1>
      {favoriteDeals.length > 0 ? (
        <section aria-labelledby="favorites-list-title">
          <h2 id="favorites-list-title">{savedDealsLabel}</h2>
          <ul>
            {favoriteDeals.map((deal) => (
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
                <p>{copy.currentPriceLabel}</p>
                <p>{deal.currentPrice}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : favoritesError ? (
        <p>{favoritesError}</p>
      ) : (
        <p>{emptyStateLabel}</p>
      )}
      <a href={appendSessionToken(buildLocaleHref(activeLocale, ""), sessionToken)}>
        {copy.backToHomeLabel}
      </a>
    </main>
  );
}
