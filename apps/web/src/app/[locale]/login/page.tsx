import React from "react";
import { notFound, redirect } from "next/navigation";

import {
  buildLoginRequestCodeRedirectTarget,
  buildLoginVerifyErrorRedirectTarget,
  buildLoginVerifySuccessRedirectTarget,
  getLoginCopy,
  submitRequestCodeFromForm,
  submitVerifyCodeFromForm,
} from "../../../lib/auth";
import {
  buildLocaleHref,
  getLocaleCopy,
  isSupportedLocale,
} from "../../../lib/publicDeals";
import { resolveSessionTokens } from "../../../lib/session";

interface LoginPageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    email?: string | string[];
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

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const activeLocale = locale;
  const copy = getLoginCopy(activeLocale);
  const localeCopy = getLocaleCopy(activeLocale);
  const resolvedSearchParams = await searchParams;
  const status = toSingleParam(resolvedSearchParams?.status);
  const email = toSingleParam(resolvedSearchParams?.email) ?? "";
  const { sessionToken } = await resolveSessionTokens(resolvedSearchParams?.sessionToken);

  async function handleRequestCode(formData: FormData) {
    "use server";

    const result = await submitRequestCodeFromForm({
      activeLocale,
      formData,
    });
    redirect(
      buildLoginRequestCodeRedirectTarget({
        activeLocale,
        status: result.status,
        email: result.email,
      }),
    );
  }

  async function handleVerifyCode(formData: FormData) {
    "use server";

    const result = await submitVerifyCodeFromForm({
      activeLocale,
      formData,
    });

    if (result.status === "success" && result.sessionToken) {
      redirect(
        buildLoginVerifySuccessRedirectTarget({
          activeLocale,
          sessionToken: result.sessionToken,
        }),
      );
    }

    redirect(
      buildLoginVerifyErrorRedirectTarget({
        activeLocale,
        email: result.email,
      }),
    );
  }

  const feedbackMessage =
    status === "request_success"
      ? copy.requestSuccessMessage
      : status === "request_error"
        ? copy.requestErrorMessage
        : status === "verify_error"
          ? copy.verifyErrorMessage
          : null;
  const accountQuickLinks = getAccountQuickLinks(activeLocale, "login", Boolean(sessionToken));

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

      <form action={handleRequestCode}>
        <p>
          <label htmlFor="login-email-request">{copy.emailLabel}</label>
        </p>
        <input defaultValue={email} id="login-email-request" name="email" type="email" />
        <button type="submit">{copy.requestCodeCtaLabel}</button>
      </form>

      <form action={handleVerifyCode}>
        <p>
          <label htmlFor="login-email-verify">{copy.emailLabel}</label>
        </p>
        <input defaultValue={email} id="login-email-verify" name="email" type="email" />

        <p>
          <label htmlFor="login-code">{copy.codeLabel}</label>
        </p>
        <input id="login-code" name="code" type="text" />
        <button type="submit">{copy.loginCtaLabel}</button>
      </form>

      <a href={buildLocaleHref(activeLocale, "")}>
        {localeCopy.backToHomeLabel}
      </a>
    </main>
  );
}
