import React, { type ReactNode } from "react";
import type { Metadata } from "next";

import { getPublicMetadataBase, isSupportedLocale } from "../../lib/publicDeals";

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

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
