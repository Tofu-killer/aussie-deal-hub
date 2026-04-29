import React from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import DealDiscoveryCard from "../../../components/DealDiscoveryCard";
import { getRecentViewSlugsFromCookie, RECENT_VIEWS_COOKIE_NAME } from "../../../lib/recentViews";
import {
  buildLocaleHref,
  getDefaultPublicDeals,
  getPublicDeal,
  isSupportedLocale,
  mergePublicDeals,
  normalizeLivePublicDeal,
} from "../../../lib/publicDeals";
import { listPublicDeals } from "../../../lib/serverApi";
import { resolveSessionTokens } from "../../../lib/session";

interface RecentViewsPageProps {
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

export default async function RecentViewsPage({ params, searchParams }: RecentViewsPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const resolvedSearchParams = await searchParams;
  const { sessionToken } = await resolveSessionTokens(resolvedSearchParams?.sessionToken);

  const cookieStore = await cookies();
  const recentViewsCookieValue = cookieStore.get(RECENT_VIEWS_COOKIE_NAME)?.value;
  const recentViewSlugs = getRecentViewSlugsFromCookie(recentViewsCookieValue);
  const publicDeals =
    recentViewSlugs.length > 0
      ? mergePublicDeals(
          (await listPublicDeals(activeLocale)).map((deal) =>
            normalizeLivePublicDeal(deal, activeLocale),
          ),
          getDefaultPublicDeals(),
        )
      : null;
  const recentDeals = recentViewSlugs
    .map((slug) => (publicDeals ? getPublicDeal(slug, publicDeals) : getPublicDeal(slug)))
    .filter((deal) => deal !== null);

  const title = activeLocale === "en" ? "Recently viewed" : "最近浏览";
  const summary =
    activeLocale === "en"
      ? "Your recently viewed deals will appear here."
      : "你最近浏览的优惠会显示在这里。";
  const listTitle = activeLocale === "en" ? "Recent deals" : "最近浏览的优惠";
  const clearRecentViewsLabel = activeLocale === "en" ? "Clear recent views" : "清空最近浏览";
  const backToHomeLabel = activeLocale === "en" ? "Back to home" : "返回首页";
  const accountQuickLinks = getAccountQuickLinks(activeLocale, "recent-views", Boolean(sessionToken));
  const ctaLabel = activeLocale === "en" ? "Open merchant page" : "打开商品页";
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";

  async function handleClearRecentViews() {
    "use server";

    const actionCookieStore = await cookies();
    actionCookieStore.set(RECENT_VIEWS_COOKIE_NAME, "", {
      expires: new Date(0),
      path: "/",
    });
    redirect(buildLocaleHref(activeLocale, "/recent-views"));
  }

  return (
    <main>
      <h1>{title}</h1>
      {recentDeals.length > 0 ? (
        <section aria-labelledby="recent-views-title">
          <h2 id="recent-views-title">{listTitle}</h2>
          <ul>
            {recentDeals.map((deal) => (
              <li key={deal.slug}>
                <DealDiscoveryCard
                  deal={deal}
                  locale={activeLocale}
                  primaryActionLabel={ctaLabel}
                  secondaryActionLabel={detailActionLabel}
                />
              </li>
            ))}
          </ul>
          <form action={handleClearRecentViews}>
            <button type="submit">{clearRecentViewsLabel}</button>
          </form>
        </section>
      ) : (
        <p>{summary}</p>
      )}
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
      <a href={buildLocaleHref(activeLocale, "")}>
        {backToHomeLabel}
      </a>
    </main>
  );
}
