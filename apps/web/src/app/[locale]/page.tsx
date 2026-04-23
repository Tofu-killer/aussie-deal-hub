import React from "react";
import { notFound } from "next/navigation";

import { LocaleSwitch } from "../../lib/ui";
import {
  appendSessionToken,
  buildLocaleHref,
  getLatestDeals,
  getLocaleCopy,
  getHomeLocaleSwitchLinks,
  getHomeSections,
  getTrendingMerchants,
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

function getAccountQuickLinks(
  locale: "en" | "zh",
  currentPage: "home" | "favorites" | "email-preferences" | "recent-views" | "login",
  sessionToken?: string,
) {
  const copy =
    locale === "en"
      ? {
          navLabel: "Account quick links",
          home: "Home",
          favorites: "My Favorites",
          emailPreferences: "Email preferences",
          recentViews: "Recently viewed",
          login: "Login",
        }
      : {
          navLabel: "账户快捷导航",
          home: "首页",
          favorites: "我的收藏",
          emailPreferences: "邮件偏好",
          recentViews: "最近浏览",
          login: "登录",
        };

  return {
    navLabel: copy.navLabel,
    links: [
      {
        href: appendSessionToken(buildLocaleHref(locale, ""), sessionToken),
        label: copy.home,
        isCurrent: currentPage === "home",
      },
      {
        href: appendSessionToken(buildLocaleHref(locale, "/favorites"), sessionToken),
        label: copy.favorites,
        isCurrent: currentPage === "favorites",
      },
      {
        href: appendSessionToken(buildLocaleHref(locale, "/email-preferences"), sessionToken),
        label: copy.emailPreferences,
        isCurrent: currentPage === "email-preferences",
      },
      {
        href: appendSessionToken(buildLocaleHref(locale, "/recent-views"), sessionToken),
        label: copy.recentViews,
        isCurrent: currentPage === "recent-views",
      },
      {
        href: appendSessionToken(buildLocaleHref(locale, "/login"), sessionToken),
        label: copy.login,
        isCurrent: currentPage === "login",
      },
    ],
  };
}

export default async function LocaleHomePage({ params, searchParams }: LocaleHomePageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);
  const sections = getHomeSections(activeLocale);
  const latestDeals = getLatestDeals();
  const trendingMerchants = getTrendingMerchants();
  const resolvedSearchParams = await searchParams;
  const sessionToken = Array.isArray(resolvedSearchParams?.sessionToken)
    ? resolvedSearchParams.sessionToken[0]
    : resolvedSearchParams?.sessionToken;
  const accountQuickLinks = getAccountQuickLinks(activeLocale, "home", sessionToken);

  return (
    <main>
      <h1>{copy.homeTitle}</h1>
      <p>{copy.homeIntro}</p>
      <form method="get" action={buildLocaleHref(activeLocale, "/search")}>
        <label htmlFor="home-search-q">{activeLocale === "en" ? "Search deals" : "搜索优惠"}</label>
        <input id="home-search-q" name="q" type="text" />
        {sessionToken ? <input type="hidden" name="sessionToken" value={sessionToken} /> : null}
        <button type="submit">{activeLocale === "en" ? "Search" : "搜索"}</button>
      </form>
      <LocaleSwitch
        currentLocale={activeLocale}
        locales={getHomeLocaleSwitchLinks(sessionToken)}
      />
      <nav aria-label={accountQuickLinks.navLabel}>
        <ul>
          {accountQuickLinks.links.map((link) => (
            <li key={link.href}>
              <a aria-current={link.isCurrent ? "page" : undefined} href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {sections.map((section) => {
        const sectionHeadingId = `home-section-${section.id}`;

        return (
          <section key={section.id} aria-labelledby={sectionHeadingId}>
            <h2 id={sectionHeadingId}>{section.title}</h2>
            <ul>
              {section.deals.map((deal) => (
                <li key={deal.slug}>
                  <a
                    href={appendSessionToken(
                      buildLocaleHref(activeLocale, `/deals/${deal.slug}`),
                      sessionToken,
                    )}
                  >
                    {deal.locales[activeLocale].title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section aria-labelledby="home-section-latest-deals">
        <h2 id="home-section-latest-deals">{copy.latestDealsTitle}</h2>
        <ul>
          {latestDeals.map((deal) => (
            <li key={`latest-${deal.slug}`}>
              <a
                href={appendSessionToken(
                  buildLocaleHref(activeLocale, `/deals/${deal.slug}`),
                  sessionToken,
                )}
              >
                {deal.locales[activeLocale].title}
              </a>{" "}
              <span>{deal.merchant.name}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="home-section-trending-merchants">
        <h2 id="home-section-trending-merchants">{copy.trendingMerchantsTitle}</h2>
        <ul>
          {trendingMerchants.map((merchant) => (
            <li key={`merchant-${merchant.id}`}>
              {merchant.name}
            </li>
          ))}
        </ul>
      </section>
      <a
        href={appendSessionToken(buildLocaleHref(activeLocale, "/favorites"), sessionToken)}
      >
        {copy.favoritesCtaLabel}
      </a>
    </main>
  );
}
