import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import DealDiscoveryCard from "../../components/DealDiscoveryCard";
import { LocaleSwitch } from "../../lib/ui";
import { listPublicDealsWithLocaleFallback } from "../../lib/serverApi";
import {
  appendQueryParams,
  buildHomePageMetadata,
  buildLocaleHref,
  getDiscoveryPublicDeals,
  getLatestDeals,
  getLocaleCopy,
  getHomeLocaleSwitchLinks,
  getHomeSections,
  getTrendingMerchants,
  isSupportedLocale,
  normalizeLivePublicDeal,
  type TrendingMerchantRecord,
} from "../../lib/publicDeals";
import { resolveSessionTokens } from "../../lib/session";

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
  isAuthenticated: boolean,
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
          logout: "Logout",
        }
      : {
          navLabel: "账户快捷导航",
          home: "首页",
          favorites: "我的收藏",
          emailPreferences: "邮件偏好",
          recentViews: "最近浏览",
          login: "登录",
          logout: "退出登录",
        };

  return {
    navLabel: copy.navLabel,
    links: [
      {
        href: buildLocaleHref(locale, ""),
        label: copy.home,
        isCurrent: currentPage === "home",
      },
      {
        href: buildLocaleHref(locale, "/favorites"),
        label: copy.favorites,
        isCurrent: currentPage === "favorites",
      },
      {
        href: buildLocaleHref(locale, "/email-preferences"),
        label: copy.emailPreferences,
        isCurrent: currentPage === "email-preferences",
      },
      {
        href: buildLocaleHref(locale, "/recent-views"),
        label: copy.recentViews,
        isCurrent: currentPage === "recent-views",
      },
      isAuthenticated
        ? {
            href: buildLocaleHref(locale, "/logout"),
            label: copy.logout,
            isCurrent: false,
          }
        : {
            href: buildLocaleHref(locale, "/login"),
            label: copy.login,
            isCurrent: currentPage === "login",
          },
    ],
  };
}

function getTrendingMerchantHref(
  locale: "en" | "zh",
  merchantId: string,
  merchantName: string,
) {
  return appendQueryParams(buildLocaleHref(locale, "/search"), {
    q: merchantName,
    merchant: merchantId,
  });
}

function getTrendingMerchantMeta(
  merchant: TrendingMerchantRecord,
  locale: "en" | "zh",
) {
  const publishedDate = merchant.latestPublishedAt.slice(0, 10);

  return locale === "en"
    ? {
        dealCountLabel: `${merchant.dealCount} ${merchant.dealCount === 1 ? "deal" : "deals"}`,
        latestLabel: `Latest ${publishedDate}`,
      }
    : {
        dealCountLabel: `${merchant.dealCount} 条优惠`,
        latestLabel: `最近 ${publishedDate}`,
      };
}

export async function generateMetadata({
  params,
}: Pick<LocaleHomePageProps, "params">): Promise<Metadata> {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  return buildHomePageMetadata(locale);
}

export default async function LocaleHomePage({ params, searchParams }: LocaleHomePageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);
  const liveDeals = (await listPublicDealsWithLocaleFallback(activeLocale)).map((deal) =>
    normalizeLivePublicDeal(deal, activeLocale),
  );
  const discoveryDeals = getDiscoveryPublicDeals(liveDeals);
  const sections = getHomeSections(activeLocale, discoveryDeals, liveDeals);
  const latestDeals = getLatestDeals(4, discoveryDeals);
  const trendingMerchants = getTrendingMerchants(4, discoveryDeals);
  const resolvedSearchParams = await searchParams;
  const { sessionToken } = await resolveSessionTokens(resolvedSearchParams?.sessionToken);
  const accountQuickLinks = getAccountQuickLinks(activeLocale, "home", Boolean(sessionToken));
  const cardActionCopy =
    activeLocale === "en"
      ? {
          detailLabel: "Read breakdown",
          featuredSummary: "Editor-picked deal lanes that open straight into the merchant page.",
        }
      : {
          detailLabel: "站内详情",
          featuredSummary: "按栏目整理的精选优惠，主点击直接进入商品页。",
        };
  const heroMetrics =
    activeLocale === "en"
      ? [
          { value: String(latestDeals.length), label: "live deals surfaced" },
          { value: String(sections.length), label: "curated lanes" },
          { value: String(trendingMerchants.length), label: "merchants trending" },
        ]
      : [
          { value: String(latestDeals.length), label: "实时优惠" },
          { value: String(sections.length), label: "精选栏目" },
          { value: String(trendingMerchants.length), label: "热门商家" },
        ];

  return (
    <main className="web-home">
      <section className="web-home__hero">
        <div className="web-home__lead">
          <p className="web-kicker">{activeLocale === "en" ? "Fresh from the deal desk" : "今日优惠速览"}</p>
          <h1>{copy.homeTitle}</h1>
          <p className="web-home__intro">{copy.homeIntro}</p>
          <form className="web-search-card" method="get" action={buildLocaleHref(activeLocale, "/search")}>
            <label htmlFor="home-search-q">{activeLocale === "en" ? "Search deals" : "搜索优惠"}</label>
            <div className="web-search-card__controls">
              <input id="home-search-q" name="q" type="text" />
              <button type="submit">{activeLocale === "en" ? "Search" : "搜索"}</button>
            </div>
          </form>
        </div>
        <aside className="web-home__aside">
          <LocaleSwitch currentLocale={activeLocale} locales={getHomeLocaleSwitchLinks()} />
          <nav aria-label={accountQuickLinks.navLabel} className="web-account-nav">
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
          <section
            className="web-metrics-panel"
            aria-label={activeLocale === "en" ? "Marketplace snapshot" : "站点概览"}
          >
            <ul>
              {heroMetrics.map((metric) => (
                <li key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>
      <div className="web-home__grid">
        {sections.map((section) => {
          const sectionHeadingId = `home-section-${section.id}`;

          return (
            <section key={section.id} aria-labelledby={sectionHeadingId} className="web-panel">
              <div className="web-panel__header">
                <h2 id={sectionHeadingId}>{section.title}</h2>
                <p>{cardActionCopy.featuredSummary}</p>
              </div>
              <ul className="web-card-list">
                {section.deals.map((deal) => (
                  <li key={deal.slug}>
                    <DealDiscoveryCard
                      deal={deal}
                      locale={activeLocale}
                      primaryActionLabel={copy.ctaLabel}
                      secondaryActionLabel={cardActionCopy.detailLabel}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <section aria-labelledby="home-section-latest-deals" className="web-panel web-panel--wide">
        <div className="web-panel__header">
          <h2 id="home-section-latest-deals">{copy.latestDealsTitle}</h2>
          <p>{activeLocale === "en" ? "Newest listings with merchant context." : "按商家上下文展示最新上架优惠。"}</p>
        </div>
        <ul className="web-card-list web-card-list--split">
          {latestDeals.map((deal) => (
            <li key={`latest-${deal.slug}`}>
              <DealDiscoveryCard
                deal={deal}
                locale={activeLocale}
                primaryActionLabel={copy.ctaLabel}
                secondaryActionLabel={cardActionCopy.detailLabel}
              />
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="home-section-trending-merchants" className="web-panel web-panel--wide">
        <div className="web-panel__header">
          <h2 id="home-section-trending-merchants">{copy.trendingMerchantsTitle}</h2>
          <p>{activeLocale === "en" ? "Merchant momentum based on recent publishing." : "按最近发布节奏展示商家热度。"}</p>
        </div>
        <ul className="web-merchant-list">
          {trendingMerchants.map((merchant) => {
            const merchantMeta = getTrendingMerchantMeta(merchant, activeLocale);
            const merchantMetaId = `merchant-meta-${merchant.id}`;

            return (
              <li key={`merchant-${merchant.id}`}>
                <a
                  aria-label={merchant.name}
                  aria-describedby={merchantMetaId}
                  className="web-merchant-link"
                  href={getTrendingMerchantHref(
                    activeLocale,
                    merchant.id,
                    merchant.name,
                  )}
                >
                  <span className="web-merchant-link__name">{merchant.name}</span>
                  <span className="web-merchant-link__meta" id={merchantMetaId}>
                    <span>{merchantMeta.dealCountLabel}</span>
                    <time dateTime={merchant.latestPublishedAt}>{merchantMeta.latestLabel}</time>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <a
        className="web-primary-link"
        href={buildLocaleHref(activeLocale, "/favorites")}
      >
        {copy.favoritesCtaLabel}
      </a>
    </main>
  );
}
