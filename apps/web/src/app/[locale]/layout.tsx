import React, { type ReactNode } from "react";
import type { Metadata } from "next";

import { buildLocaleHref, getPublicMetadataBase, isSupportedLocale } from "../../lib/publicDeals";

import "./globals.css";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export const metadata: Metadata = {
  metadataBase: getPublicMetadataBase(),
};

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  const lang = isSupportedLocale(locale) ? locale : "en";
  const homeHref = buildLocaleHref(lang, "");

  return (
    <html lang={lang}>
      <body className="web-body">
        <div className="web-backdrop web-backdrop--amber" aria-hidden="true" />
        <div className="web-backdrop web-backdrop--teal" aria-hidden="true" />
        <div className="web-shell">
          <header className="web-masthead">
            <div>
              <p className="web-masthead__eyebrow">Australian price intelligence</p>
              <a className="web-masthead__brand" href={homeHref}>
                Aussie Deal Hub
              </a>
            </div>
            <p className="web-masthead__summary">
              Track bilingual Australian deals with a cleaner price story and faster handoff to
              checkout.
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
