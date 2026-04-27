import { buildDigestJob, type DigestDealRecord, type DigestLocale, type DigestJobPayload } from "./buildDigest";

export interface EligibleDigestSubscription {
  email: string;
  locale: DigestLocale;
  frequency: string;
  categories: string[];
  lastSentAt: string | null;
}

export interface DigestSubscriptionStore {
  listEligibleSubscriptions(now: Date): Promise<EligibleDigestSubscription[]>;
  markSent(email: string, sentAt: Date): Promise<void>;
}

export interface DigestFavoriteStore {
  listByEmail(email: string): Promise<Array<{ dealId: string }>>;
}

export interface DigestDealStore {
  listDigestDeals(): Promise<DigestDealRecord[]>;
}

export interface DigestSender {
  sendDigest(input: {
    email: string;
    locale: DigestLocale;
    subject: string;
    html: string;
    deals: DigestJobPayload["deals"];
  }): Promise<void>;
}

export interface SendDailyDigestsOptions {
  now?: Date;
}

export interface SendDailyDigestsSummary {
  sentCount: number;
  skippedCount: number;
  sentEmails: string[];
}

const WEEKLY_DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeDigestCategory(category: string): string | null {
  switch (category.trim().toLowerCase()) {
    case "deals":
      return "deals";
    case "historical lows":
    case "historical-lows":
      return "historical-lows";
    case "freebies":
      return "freebies";
    case "gift card offers":
    case "gift-card-offers":
      return "gift-card-offers";
    default:
      return null;
  }
}

function getStartOfUtcDay(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function toDigestFrequency(frequency: string): "daily" | "weekly" {
  return frequency === "weekly" ? "weekly" : "daily";
}

function wasSentInCurrentDigestWindow(
  frequency: string,
  lastSentAt: string | null,
  now: Date,
) {
  if (!lastSentAt) {
    return false;
  }

  const sentAt = new Date(lastSentAt);

  if (Number.isNaN(sentAt.getTime())) {
    return false;
  }

  if (toDigestFrequency(frequency) === "weekly") {
    return now.getTime() - sentAt.getTime() < WEEKLY_DIGEST_INTERVAL_MS;
  }

  return sentAt >= getStartOfUtcDay(now);
}

export async function sendDailyDigests(
  subscriptionStore: DigestSubscriptionStore,
  favoriteStore: DigestFavoriteStore,
  dealStore: DigestDealStore,
  digestSender: DigestSender,
  options: SendDailyDigestsOptions = {},
): Promise<SendDailyDigestsSummary> {
  const now = options.now ?? new Date();
  const subscriptions = await subscriptionStore.listEligibleSubscriptions(now);
  const digestDeals = await dealStore.listDigestDeals();
  const summary: SendDailyDigestsSummary = {
    sentCount: 0,
    skippedCount: 0,
    sentEmails: [],
  };

  for (const subscription of subscriptions) {
    if (
      wasSentInCurrentDigestWindow(
        subscription.frequency,
        subscription.lastSentAt,
        now,
      )
    ) {
      summary.skippedCount += 1;
      continue;
    }

    const favorites = await favoriteStore.listByEmail(subscription.email);
    const favoriteDealIds = new Set(favorites.map((favorite) => favorite.dealId));
    const selectedCategories = new Set(
      subscription.categories
        .map((category) => normalizeDigestCategory(category))
        .filter((category): category is string => category !== null),
    );
    const matchingDeals = digestDeals.filter((deal) => {
      const englishSlug = deal.locales.en.slug ?? "";
      const chineseSlug = deal.locales.zh.slug ?? "";
      const normalizedDealCategory = normalizeDigestCategory(deal.category);

      return (
        normalizedDealCategory !== null &&
        selectedCategories.has(normalizedDealCategory) &&
        (favoriteDealIds.has(englishSlug) || favoriteDealIds.has(chineseSlug))
      );
    });

    if (matchingDeals.length === 0) {
      summary.skippedCount += 1;
      continue;
    }

    const localizedDigest = buildDigestJob(
      matchingDeals.map((deal) => ({
        ...deal,
        slug: subscription.locale === "zh" ? deal.locales.zh.slug : deal.locales.en.slug,
      })),
      {
        frequency: toDigestFrequency(subscription.frequency),
      },
    )[subscription.locale];

    await digestSender.sendDigest({
      email: subscription.email,
      locale: subscription.locale,
      subject: localizedDigest.subject,
      html: localizedDigest.html,
      deals: localizedDigest.deals,
    });
    await subscriptionStore.markSent(subscription.email, now);
    summary.sentCount += 1;
    summary.sentEmails.push(subscription.email);
  }

  return summary;
}
