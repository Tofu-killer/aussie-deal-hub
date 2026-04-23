import React from "react";
import { notFound, redirect } from "next/navigation";

import { appendSessionToken, buildLocaleHref, getLocaleCopy, getPublicDeal, isSupportedLocale } from "../../../lib/publicDeals";
import { listFavoriteDealIds, removeFavoriteDealId } from "../../../lib/serverApi";

interface FavoritesPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    removeStatus?: string | string[];
    sessionToken?: string | string[];
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

function buildFavoritesHref(locale: "en" | "zh", sessionToken?: string) {
  return appendSessionToken(buildLocaleHref(locale, "/favorites"), sessionToken);
}

function buildRemoveFavoriteRedirectTarget(
  locale: "en" | "zh",
  sessionToken: string | undefined,
  status: RemoveFavoriteStatus | null,
) {
  const target = buildFavoritesHref(locale, sessionToken);

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
  const sessionToken = toSingleSearchParam(resolvedSearchParams?.sessionToken);
  const removeStatus = toRemoveFavoriteStatus(toSingleSearchParam(resolvedSearchParams?.removeStatus));
  let favoriteItems = [] as FavoriteListItem[];
  let favoritesError: string | null = null;

  try {
    favoriteItems = (await listFavoriteDealIds(sessionToken)).map((favorite) => {
      const deal = getPublicDeal(favorite.dealId);

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
  const accountQuickLinks = getAccountQuickLinks(activeLocale, "favorites", sessionToken);

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

    redirect(buildRemoveFavoriteRedirectTarget(activeLocale, sessionToken, status));
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
                    <a
                      href={appendSessionToken(
                        buildLocaleHref(activeLocale, `/deals/${item.deal.slug}`),
                        sessionToken,
                      )}
                    >
                      {item.deal.locales[activeLocale].title}
                    </a>
                    <p>{item.deal.locales[activeLocale].summary}</p>
                    <p>{copy.currentPriceLabel}</p>
                    <p>{item.deal.currentPrice}</p>
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
                <form action={handleRemoveFavorite}>
                  <input name="dealId" type="hidden" value={item.dealId} />
                  <button type="submit">{removeFavoriteLabel}</button>
                </form>
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
