import { buildDailyDigest } from "@aussie-deal-hub/email/buildDailyDigest";

export type DigestLocale = "en" | "zh";

export interface DigestLocaleContent {
  title: string;
  merchant?: string;
}

export interface DigestDealRecord {
  id: string;
  merchant: string;
  status: string;
  locales: Record<DigestLocale, DigestLocaleContent>;
}

export interface DigestDealPayload {
  id: string;
  merchant: string;
  title: string;
}

export interface DigestJobPayload {
  locale: DigestLocale;
  subject: string;
  html: string;
  deals: DigestDealPayload[];
}

function buildLocaleDigest(
  locale: DigestLocale,
  deals: DigestDealRecord[],
): DigestJobPayload {
  const localizedDeals = deals
    .filter((deal) => deal.status === "published")
    .map((deal) => ({
      id: deal.id,
      merchant: deal.locales[locale].merchant ?? deal.merchant,
      title: deal.locales[locale].title,
    }));

  const digest = buildDailyDigest(
    locale,
    localizedDeals.map((deal) => ({
      merchant: deal.merchant,
      title: deal.title,
    })),
  );

  return {
    locale,
    subject: digest.subject,
    html: digest.html,
    deals: localizedDeals,
  };
}

export function buildDigestJob(
  deals: DigestDealRecord[],
): Record<DigestLocale, DigestJobPayload> {
  return {
    en: buildLocaleDigest("en", deals),
    zh: buildLocaleDigest("zh", deals),
  };
}
