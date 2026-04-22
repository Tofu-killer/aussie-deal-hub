import React from "react";
import { notFound } from "next/navigation";

import { buildLocaleHref, getLocaleCopy, isSupportedLocale } from "../../../lib/publicDeals";

interface FavoritesPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);

  return (
    <main>
      <h1>{copy.favoritesTitle}</h1>
      <p>{copy.favoritesSummary}</p>
      <a href={buildLocaleHref(activeLocale, "")}>{copy.backToHomeLabel}</a>
    </main>
  );
}
