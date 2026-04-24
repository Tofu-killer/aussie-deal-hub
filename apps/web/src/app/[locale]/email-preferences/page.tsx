import React from "react";
import { notFound, redirect } from "next/navigation";

import { appendSessionToken, buildLocaleHref, getLocaleCopy, isSupportedLocale } from "../../../lib/publicDeals";
import {
  getEmailPreferencesCopy,
  submitDigestPreferencesFromForm,
} from "../../../lib/emailPreferences";
import { getDigestPreferences } from "../../../lib/serverApi";
import { resolveSessionTokens } from "../../../lib/session";

interface EmailPreferencesPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    sessionToken?: string | string[];
    status?: string | string[];
  }>;
}

function toSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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
      sessionToken
        ? {
            href: buildLocaleHref(locale, "/logout"),
            label: copy.logout,
            isCurrent: false,
          }
        : {
            href: appendSessionToken(buildLocaleHref(locale, "/login"), sessionToken),
            label: copy.login,
            isCurrent: currentPage === "login",
          },
    ],
  };
}

export default async function EmailPreferencesPage({
  params,
  searchParams,
}: EmailPreferencesPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getEmailPreferencesCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const { sessionToken, urlSessionToken } = await resolveSessionTokens(
    resolvedSearchParams?.sessionToken,
  );
  const status = toSingleParam(resolvedSearchParams?.status);
  const localeCopy = getLocaleCopy(activeLocale);

  let preferences = {
    locale: activeLocale,
    frequency: "daily",
    categories: [] as string[],
  };
  let loadErrorMessage: string | null = null;

  try {
    const persistedPreferences = await getDigestPreferences(sessionToken);
    preferences = {
      locale: persistedPreferences.locale === "zh" ? "zh" : "en",
      frequency: persistedPreferences.frequency,
      categories: persistedPreferences.categories,
    };
  } catch {
    loadErrorMessage = copy.loadErrorMessage;
  }

  async function handleSubmit(formData: FormData) {
    "use server";

    const result = await submitDigestPreferencesFromForm({
      activeLocale,
      sessionToken,
      formData,
    });

    const target = appendSessionToken(
      buildLocaleHref(activeLocale, "/email-preferences"),
      urlSessionToken,
    );
    const url = new URL(target, "http://local.test");
    url.searchParams.set("status", result.status);
    redirect(`${url.pathname}${url.search}`);
  }

  const feedbackMessage = loadErrorMessage
    ? loadErrorMessage
    : status === "success"
      ? copy.saveSuccessMessage
      : status === "error"
        ? copy.saveErrorMessage
        : null;
  const accountQuickLinks = getAccountQuickLinks(
    activeLocale,
    "email-preferences",
    urlSessionToken,
  );

  return (
    <main>
      <h1>{copy.pageTitle}</h1>
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
      {feedbackMessage ? <p>{feedbackMessage}</p> : null}
      <form action={handleSubmit}>
        <p>
          <label htmlFor="digest-locale">{copy.digestLocaleLabel}</label>
        </p>
        <select
          defaultValue={preferences.locale}
          id="digest-locale"
          name="locale"
        >
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>

        <p>
          <label htmlFor="digest-frequency">{copy.digestFrequencyLabel}</label>
        </p>
        <select
          defaultValue={preferences.frequency}
          id="digest-frequency"
          name="frequency"
        >
          <option value="daily">{copy.frequencyDaily}</option>
          <option value="weekly">{copy.frequencyWeekly}</option>
        </select>

        <fieldset>
          <legend>{copy.categoriesLegend}</legend>
          <label htmlFor="category-deals">
            <input
              defaultChecked={preferences.categories.includes("deals")}
              id="category-deals"
              name="categories"
              type="checkbox"
              value="deals"
            />
            {copy.categoryDeals}
          </label>
          <label htmlFor="category-historical-lows">
            <input
              defaultChecked={preferences.categories.includes("historical-lows")}
              id="category-historical-lows"
              name="categories"
              type="checkbox"
              value="historical-lows"
            />
            {copy.categoryHistoricalLows}
          </label>
        </fieldset>

        <button type="submit">{copy.saveCtaLabel}</button>
      </form>
      <a href={appendSessionToken(buildLocaleHref(activeLocale, ""), urlSessionToken)}>
        {localeCopy.backToHomeLabel}
      </a>
    </main>
  );
}
