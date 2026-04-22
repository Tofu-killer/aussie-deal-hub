import React from "react";
import { notFound } from "next/navigation";

import { LocaleSwitch } from "../../lib/ui";
import {
  DEFAULT_DEAL,
  buildLocaleHref,
  getLocaleCopy,
  getHomeLocaleSwitchLinks,
  isSupportedLocale,
} from "../../lib/publicDeals";

interface LocaleHomePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);

  return (
    <main>
      <h1>{copy.homeTitle}</h1>
      <p>{copy.homeIntro}</p>
      <LocaleSwitch
        currentLocale={activeLocale}
        locales={getHomeLocaleSwitchLinks()}
      />
      <ul>
        <li>
          <a href={buildLocaleHref(activeLocale, `/deals/${DEFAULT_DEAL.slug}`)}>
            {DEFAULT_DEAL.locales[activeLocale].title}
          </a>
        </li>
      </ul>
      <a href={buildLocaleHref(activeLocale, "/favorites")}>
        {copy.favoritesCtaLabel}
      </a>
    </main>
  );
}
