import { buildDailyDigest } from "@aussie-deal-hub/email/buildDailyDigest";

export type DigestLocale = "en" | "zh";

export interface DigestLocaleContent {
  slug?: string;
  title: string;
  merchant?: string;
}

export interface DigestDealRecord {
  id: string;
  slug?: string;
  merchant: string;
  status: string;
  locales: Record<DigestLocale, DigestLocaleContent>;
}

export interface DigestFavoriteRecord {
  dealId: string;
}

export interface DigestPersistedInput {
  favorites: DigestFavoriteRecord[];
  deals: DigestDealRecord[];
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
      id: deal.slug ?? deal.id,
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

function resolveDigestDeals(
  input: DigestDealRecord[] | DigestPersistedInput,
): DigestDealRecord[] {
  if (Array.isArray(input)) {
    return input;
  }

  const favoriteDealIds = new Set(input.favorites.map((favorite) => favorite.dealId));

  return input.deals.filter((deal) => favoriteDealIds.has(deal.slug ?? deal.id));
}

export function buildDigestJob(
  input: DigestDealRecord[] | DigestPersistedInput,
): Record<DigestLocale, DigestJobPayload> {
  const deals = resolveDigestDeals(input);

  return {
    en: buildLocaleDigest("en", deals),
    zh: buildLocaleDigest("zh", deals),
  };
}
