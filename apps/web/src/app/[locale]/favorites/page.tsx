import React from "react";
import { notFound, redirect } from "next/navigation";

import DealDiscoveryCard from "../../../components/DealDiscoveryCard";
import {
  buildLocaleHref,
  getDefaultPublicDeals,
  getLocaleCopy,
  getPublicDeal,
  isSupportedLocale,
  mergePublicDeals,
  normalizeLivePublicDeal,
} from "../../../lib/publicDeals";
import {
  listFavoriteDealIds,
  listPublicDealsWithLocaleFallback,
  removeFavoriteDealId,
} from "../../../lib/serverApi";
import { resolveSessionTokens } from "../../../lib/session";

interface FavoritesPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    removeStatus?: string | string[];
  }>;
}

type FavoriteListItem =
  | {
      type: "deal";
      deal: NonNullable<ReturnType<typeof getPublicDeal>>;
      dealId: string;
    }
  | {
      type: "orphan";
      dealId: string;
    };

type RemoveFavoriteStatus = "error";

function toSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toRemoveFavoriteStatus(value: string | undefined): RemoveFavoriteStatus | null {
  return value === "error" ? value : null;
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

function buildFavoritesHref(locale: "en" | "zh") {
  return buildLocaleHref(locale, "/favorites");
}

function buildRemoveFavoriteRedirectTarget(
  locale: "en" | "zh",
  status: RemoveFavoriteStatus | null,
) {
  const target = buildFavoritesHref(locale);

  if (!status) {
    return target;
  }

  const url = new URL(target, "http://local.test");
  url.searchParams.set("removeStatus", status);

  return `${url.pathname}${url.search}`;
}

export default async function FavoritesPage({ params, searchParams }: FavoritesPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const { sessionToken } = await resolveSessionTokens();
  const removeStatus = toRemoveFavoriteStatus(toSingleSearchParam(resolvedSearchParams?.removeStatus));
  let favoriteItems = [] as FavoriteListItem[];
  let favoritesError: string | null = null;

  try {
    const favorites = await listFavoriteDealIds(sessionToken);
    const publicDeals =
      favorites.length > 0
        ? mergePublicDeals(
            (await listPublicDealsWithLocaleFallback(activeLocale)).map((deal) =>
              normalizeLivePublicDeal(deal, activeLocale),
            ),
            getDefaultPublicDeals(),
          )
        : null;

    favoriteItems = favorites.map((favorite) => {
      const deal = publicDeals
        ? getPublicDeal(favorite.dealId, publicDeals)
        : getPublicDeal(favorite.dealId);

      if (deal) {
        return {
          type: "deal",
          deal,
          dealId: favorite.dealId,
        };
      }

      return {
        type: "orphan",
        dealId: favorite.dealId,
      };
    });
  } catch {
    favoritesError = activeLocale === "en" ? "Unable to load favorites." : "无法加载收藏。";
  }
  const savedDealsLabel = activeLocale === "en" ? "Saved deals" : "已保存优惠";
  const emptyStateLabel = activeLocale === "en" ? "No favorites saved yet." : "还没有保存的收藏。";
  const removeFavoriteLabel = activeLocale === "en" ? "Remove" : "移除";
  const removeFavoriteErrorMessage =
    removeStatus === "error"
      ? activeLocale === "en"
        ? "Unable to remove favorite."
        : "移除收藏失败，请稍后再试。"
      : null;
  const orphanFavoriteTitle =
    activeLocale === "en" ? "Saved deal unavailable" : "已保存优惠暂不可用";
  const orphanFavoriteSummary =
    activeLocale === "en"
      ? "This saved deal is no longer published."
      : "这条收藏优惠已不再公开展示。";
  const orphanFavoriteDealIdLabel = activeLocale === "en" ? "Deal ID" : "优惠 ID";
  const accountQuickLinks = getAccountQuickLinks(activeLocale, "favorites", Boolean(sessionToken));
  const detailActionLabel = activeLocale === "en" ? "Read breakdown" : "站内详情";

  async function handleRemoveFavorite(formData: FormData) {
    "use server";

    const dealId = formData.get("dealId")?.toString();
    let status: RemoveFavoriteStatus | null = null;

    if (dealId && dealId.length > 0) {
      try {
        await removeFavoriteDealId(sessionToken, dealId);
      } catch {
        status = "error";
      }
    }

    redirect(buildRemoveFavoriteRedirectTarget(activeLocale, status));
  }

  return (
    <main>
      <h1>{copy.favoritesTitle}</h1>
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
      {removeFavoriteErrorMessage ? <p role="status">{removeFavoriteErrorMessage}</p> : null}
      {favoriteItems.length > 0 ? (
        <section aria-labelledby="favorites-list-title">
          <h2 id="favorites-list-title">{savedDealsLabel}</h2>
          <ul>
            {favoriteItems.map((item) => (
              <li key={item.dealId}>
                {item.type === "deal" ? (
                  <>
                    <DealDiscoveryCard
                      deal={item.deal}
                      locale={activeLocale}
                      primaryActionLabel={copy.ctaLabel}
                      secondaryActionLabel={detailActionLabel}
                    />
                    <form action={handleRemoveFavorite}>
                      <input name="dealId" type="hidden" value={item.dealId} />
                      <button type="submit">{removeFavoriteLabel}</button>
                    </form>
                  </>
                ) : (
                  <>
                    <p>{orphanFavoriteTitle}</p>
                    <p>{orphanFavoriteSummary}</p>
                    <p>
                      {orphanFavoriteDealIdLabel}: <code>{item.dealId}</code>
                    </p>
                  </>
                )}
                {item.type === "orphan" ? (
                  <form action={handleRemoveFavorite}>
                    <input name="dealId" type="hidden" value={item.dealId} />
                    <button type="submit">{removeFavoriteLabel}</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : favoritesError ? (
        <p>{favoritesError}</p>
      ) : (
        <p>{emptyStateLabel}</p>
      )}
      <a href={buildLocaleHref(activeLocale, "")}>
        {copy.backToHomeLabel}
      </a>
    </main>
  );
}
