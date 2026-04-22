import React from "react";
import { notFound } from "next/navigation";

import { LocaleSwitch } from "../../lib/ui";
import {
  appendSessionToken,
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
  searchParams?: Promise<{
    sessionToken?: string | string[];
  }>;
}

export default async function LocaleHomePage({ params, searchParams }: LocaleHomePageProps) {
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

  return (
    <main>
      <h1>{copy.homeTitle}</h1>
      <p>{copy.homeIntro}</p>
      <LocaleSwitch
        currentLocale={activeLocale}
        locales={getHomeLocaleSwitchLinks(sessionToken)}
      />
      <ul>
        <li>
          <a
            href={appendSessionToken(
              buildLocaleHref(activeLocale, `/deals/${DEFAULT_DEAL.slug}`),
              sessionToken,
            )}
          >
            {DEFAULT_DEAL.locales[activeLocale].title}
          </a>
        </li>
      </ul>
      <a
        href={appendSessionToken(buildLocaleHref(activeLocale, "/favorites"), sessionToken)}
      >
        {copy.favoritesCtaLabel}
      </a>
    </main>
  );
}
