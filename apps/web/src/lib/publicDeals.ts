import type { Metadata, MetadataRoute } from "next";

export type SupportedLocale = "en" | "zh";

interface LocaleCopy {
  currentPriceLabel: string;
  ctaLabel: string;
  detailCouponCodeLabel: string;
  detailHighlightsLabel: string;
  detailHowToGetItLabel: string;
  detailMerchantLabel: string;
  detailNoCouponCodeLabel: string;
  detailTermsLabel: string;
  detailValidityLabel: string;
  detailWhyWorthItLabel: string;
  favoritesCtaLabel: string;
  backToHomeLabel: string;
  favoritesTitle: string;
  favoritesSummary: string;
  homeIntro: string;
  homeTitle: string;
  localeLabels: Record<SupportedLocale, string>;
  latestDealsTitle: string;
  missingDealTitle: string;
  missingDealCtaLabel: string;
  originalPriceLabel: string;
  trendingMerchantsTitle: string;
}

export interface LocalizedDealContent {
  summary: string;
  title: string;
}

export interface LocalizedDealDetailContent {
  highlights: string[];
  howToGetIt: string[];
  termsAndWarnings: string[];
  validity: string;
  whyWorthIt: string;
}

export interface PublicDealDetailMetadata {
  couponCode: string | null;
  endingSoon?: boolean;
  expiresAt: string;
  freeShipping?: boolean;
  locales: Record<SupportedLocale, LocalizedDealDetailContent>;
  validFrom: string;
}

export type PublicDealCategory =
  | "deals"
  | "historical-lows"
  | "freebies"
  | "gift-card-offers";

export const PUBLIC_PRIMARY_CATEGORIES: PublicDealCategory[] = [
  "deals",
  "historical-lows",
  "freebies",
  "gift-card-offers",
];

export interface PublicDealRecord {
  categories: PublicDealCategory[];
  currentPrice: string;
  dealUrl: string;
  detail: PublicDealDetailMetadata;
  discountLabel: string;
  locales: Record<SupportedLocale, LocalizedDealContent>;
  merchant: {
    id: string;
    name: string;
  };
  originalPrice: string;
  publishedAt: string;
  slug: string;
}

export interface TrendingMerchantRecord {
  dealCount: number;
  id: string;
  latestPublishedAt: string;
  name: string;
}

export type PublicDealDiscountBand = "under-20" | "20-plus" | "free";

export interface PublicListingFilters {
  discountBand?: PublicDealDiscountBand;
  endingSoon?: boolean;
  freeShipping?: boolean;
  historicalLow?: boolean;
  merchant?: string;
}

export interface PublicListingFilterSearchParams {
  "discount-band"?: string | string[];
  "ending-soon"?: string | string[];
  "free-shipping"?: string | string[];
  "historical-low"?: string | string[];
  merchant?: string | string[];
}

export interface LivePublicDealInput {
  affiliateUrl?: string;
  category: string;
  currentPrice?: string;
  locale: SupportedLocale | string;
  merchant?: string;
  priceContext?: {
    snapshots?: Array<{
      label: string;
      merchant: string;
      observedAt: string;
      price: string;
    }>;
  };
  publishedAt?: string;
  slug: string;
  summary: string;
  title: string;
}

type HomeSectionId = "featured" | "historical-lows" | "freebies" | "gift-card-offers";

export interface HomeSectionDefinition {
  id: HomeSectionId;
  locales: Record<SupportedLocale, string>;
  slugs: string[];
}

interface PublicHomeSection {
  deals: PublicDealRecord[];
  id: HomeSectionId;
  title: string;
}

export const PUBLIC_DEAL_CATEGORY_LABELS: Record<
  PublicDealCategory,
  Record<SupportedLocale, string>
> = {
  deals: {
    en: "Deals",
    zh: "优惠",
  },
  "historical-lows": {
    en: "Historical lows",
    zh: "历史低价",
  },
  freebies: {
    en: "Freebies",
    zh: "免费领取",
  },
  "gift-card-offers": {
    en: "Gift card offers",
    zh: "礼品卡优惠",
  },
};

export const DEFAULT_DEAL: PublicDealRecord = {
  slug: "nintendo-switch-oled-amazon-au",
  categories: ["deals", "historical-lows"],
  currentPrice: "A$399",
  originalPrice: "A$469",
  discountLabel: "15% off",
  dealUrl: "https://www.amazon.com.au/deal",
  detail: {
    couponCode: "GAME20",
    endingSoon: false,
    validFrom: "2026-04-22",
    expiresAt: "2026-04-30",
    freeShipping: false,
    locales: {
      en: {
        validity: "Valid until 2026-04-30",
        whyWorthIt: "It undercuts the usual A$469 shelf price by A$70 before shipping.",
        highlights: [
          "A$399 is the seeded tracked low for this model.",
          "Sold by Amazon AU with local checkout.",
        ],
        howToGetIt: ["Open the Amazon AU deal page.", "Apply GAME20 at checkout."],
        termsAndWarnings: [
          "Coupon availability can change without notice.",
          "Check delivery costs before placing the order.",
        ],
      },
      zh: {
        validity: "有效期至 2026-04-30",
        whyWorthIt: "相比常见 A$469 标价低 A$70，运费另计。",
        highlights: ["A$399 是该机型的 seeded 监测低价。", "由 Amazon AU 销售并走本地结账。"],
        howToGetIt: ["打开 Amazon AU 优惠页面。", "结账时输入 GAME20。"],
        termsAndWarnings: ["优惠码可能随时失效。", "下单前请确认配送费用。"],
      },
    },
  },
  merchant: {
    id: "amazon-au",
    name: "Amazon AU",
  },
  publishedAt: "2026-04-22T09:00:00.000Z",
  locales: {
    en: {
      title: "Nintendo Switch OLED for A$399 at Amazon AU",
      summary: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
    },
    zh: {
      title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      summary: "使用优惠码 GAME20 后达到很强的澳洲站价格。",
    },
  },
};

const PUBLIC_DEALS: PublicDealRecord[] = [
  DEFAULT_DEAL,
  {
    slug: "airpods-pro-2-costco-au",
    categories: ["historical-lows"],
    currentPrice: "A$299",
    originalPrice: "A$399",
    discountLabel: "25% off",
    dealUrl: "https://www.costco.com.au/deal",
    detail: {
      couponCode: "WAREHOUSE25",
      endingSoon: true,
      validFrom: "2026-04-21",
      expiresAt: "2026-04-28",
      freeShipping: true,
      locales: {
        en: {
          validity: "Valid until 2026-04-28",
          whyWorthIt: "The seeded price is A$100 below the reference A$399 ticket.",
          highlights: [
            "Warehouse promotion targets a tracked low for AirPods Pro.",
            "Useful for buyers with Costco access.",
          ],
          howToGetIt: ["Open the Costco AU deal page.", "Apply WAREHOUSE25 if prompted."],
          termsAndWarnings: [
            "Costco membership may be required.",
            "Stock and warehouse delivery windows can vary.",
          ],
        },
        zh: {
          validity: "有效期至 2026-04-28",
          whyWorthIt: "seeded 价格比参考 A$399 低 A$100。",
          highlights: ["仓储促销把 AirPods Pro 压到监测低价。", "适合已有 Costco 资格的买家。"],
          howToGetIt: ["打开 Costco AU 优惠页面。", "如结账提示，输入 WAREHOUSE25。"],
          termsAndWarnings: ["可能需要 Costco 会员资格。", "库存和仓配时效可能变化。"],
        },
      },
    },
    merchant: {
      id: "costco-au",
      name: "Costco AU",
    },
    publishedAt: "2026-04-21T09:00:00.000Z",
    locales: {
      en: {
        title: "AirPods Pro (2nd Gen) for A$299 at Costco AU",
        summary: "Warehouse promo puts Apple earbuds at a tracked low.",
      },
      zh: {
        title: "Costco 澳洲 AirPods Pro（第二代）A$299",
        summary: "仓储促销把苹果耳机压到历史监测低位。",
      },
    },
  },
  {
    slug: "epic-game-freebie-week",
    categories: ["freebies"],
    currentPrice: "A$0",
    originalPrice: "A$59",
    discountLabel: "Free",
    dealUrl: "https://store.epicgames.com/deal",
    detail: {
      couponCode: null,
      endingSoon: false,
      validFrom: "2026-04-20",
      expiresAt: "2026-04-27",
      freeShipping: true,
      locales: {
        en: {
          validity: "Valid until 2026-04-27",
          whyWorthIt: "The free claim drops a normally paid PC title to A$0.",
          highlights: [
            "No payment is needed during the weekly freebie window.",
            "The claim stays attached to the account after redemption.",
          ],
          howToGetIt: ["Open the Epic Games Store deal page.", "Sign in and claim the weekly freebie."],
          termsAndWarnings: [
            "The freebie rotates after the campaign window.",
            "Platform account and launcher requirements may apply.",
          ],
        },
        zh: {
          validity: "有效期至 2026-04-27",
          whyWorthIt: "本次领取把原付费 PC 游戏降到 A$0。",
          highlights: ["周免窗口内无需付款。", "领取后会绑定到账户。"],
          howToGetIt: ["打开 Epic Games Store 优惠页面。", "登录并领取本周限免。"],
          termsAndWarnings: ["周免会在活动结束后轮换。", "可能需要平台账号和启动器。"],
        },
      },
    },
    merchant: {
      id: "epic-games-store",
      name: "Epic Games Store",
    },
    publishedAt: "2026-04-20T09:00:00.000Z",
    locales: {
      en: {
        title: "Epic weekly freebie now A$0",
        summary: "Claim this week's PC title before the rotation resets.",
      },
      zh: {
        title: "Epic 本周限免游戏现价 A$0",
        summary: "在轮换结束前领取本周 PC 免费游戏。",
      },
    },
  },
  {
    slug: "coles-gift-card-bonus-credit",
    categories: ["gift-card-offers"],
    currentPrice: "A$90",
    originalPrice: "A$100",
    discountLabel: "10% bonus value",
    dealUrl: "https://www.coles.com.au/deal",
    detail: {
      couponCode: "BONUS10",
      endingSoon: true,
      validFrom: "2026-04-19",
      expiresAt: "2026-04-26",
      freeShipping: false,
      locales: {
        en: {
          validity: "Valid until 2026-04-26",
          whyWorthIt: "The seeded offer gives A$100 card value for A$90 spend.",
          highlights: [
            "Best suited to planned spend at eligible brands.",
            "Bonus value is clearer than a delayed cashback.",
          ],
          howToGetIt: ["Open the Coles deal page.", "Choose an eligible gift card and apply BONUS10."],
          termsAndWarnings: [
            "Eligible brands may be limited.",
            "Gift cards can carry redemption and expiry conditions.",
          ],
        },
        zh: {
          validity: "有效期至 2026-04-26",
          whyWorthIt: "seeded 活动用 A$90 换 A$100 礼品卡价值。",
          highlights: ["更适合已有指定品牌消费计划的用户。", "额外面值比延迟返现更直观。"],
          howToGetIt: ["打开 Coles 优惠页面。", "选择符合条件的礼品卡并使用 BONUS10。"],
          termsAndWarnings: ["适用品牌可能有限。", "礼品卡可能有使用和过期条件。"],
        },
      },
    },
    merchant: {
      id: "coles",
      name: "Coles",
    },
    publishedAt: "2026-04-19T09:00:00.000Z",
    locales: {
      en: {
        title: "A$100 gift card value for A$90 at Coles",
        summary: "Gift card campaign adds bonus spend for selected brands.",
      },
      zh: {
        title: "Coles 指定礼品卡 A$90 兑 A$100 面值",
        summary: "礼品卡活动为指定品牌增加额外可用额度。",
      },
    },
  },
];

const HOME_SECTIONS: HomeSectionDefinition[] = [
  {
    id: "featured",
    locales: {
      en: "Featured deals",
      zh: "精选优惠",
    },
    slugs: ["nintendo-switch-oled-amazon-au"],
  },
  {
    id: "historical-lows",
    locales: {
      en: "Historical lows",
      zh: "历史低价",
    },
    slugs: ["airpods-pro-2-costco-au"],
  },
  {
    id: "freebies",
    locales: {
      en: "Freebies",
      zh: "免费领取",
    },
    slugs: ["epic-game-freebie-week"],
  },
  {
    id: "gift-card-offers",
    locales: {
      en: "Gift card offers",
      zh: "礼品卡优惠",
    },
    slugs: ["coles-gift-card-bonus-credit"],
  },
];

const LOCALE_COPY: Record<SupportedLocale, LocaleCopy> = {
  en: {
    currentPriceLabel: "Current price",
    detailCouponCodeLabel: "Coupon code",
    detailHighlightsLabel: "Deal highlights",
    detailHowToGetItLabel: "How to get it",
    detailMerchantLabel: "Merchant",
    detailNoCouponCodeLabel: "No code required",
    detailTermsLabel: "Terms and warnings",
    detailValidityLabel: "Validity",
    detailWhyWorthItLabel: "Why this is worth it",
    homeTitle: "Today's picks",
    homeIntro: "Browse bilingual Australian deals with a clear price hierarchy and fast merchant CTA.",
    favoritesTitle: "My Favorites",
    favoritesSummary: "Saved published deals will appear here.",
    ctaLabel: "Open merchant page",
    favoritesCtaLabel: "Open Favorites",
    backToHomeLabel: "Back to home",
    missingDealTitle: "Deal not found",
    missingDealCtaLabel: "Return home",
    originalPriceLabel: "Original price",
    latestDealsTitle: "Latest deals",
    trendingMerchantsTitle: "Trending merchants",
    localeLabels: {
      en: "English",
      zh: "中文",
    },
  },
  zh: {
    currentPriceLabel: "当前价格",
    detailCouponCodeLabel: "优惠码",
    detailHighlightsLabel: "优惠亮点",
    detailHowToGetItLabel: "如何领取",
    detailMerchantLabel: "商家",
    detailNoCouponCodeLabel: "无需优惠码",
    detailTermsLabel: "条款与提醒",
    detailValidityLabel: "有效期",
    detailWhyWorthItLabel: "为什么值得买",
    homeTitle: "今日精选",
    homeIntro: "用清晰的价格层级和直接跳转按钮浏览双语澳洲优惠。",
    favoritesTitle: "我的收藏",
    favoritesSummary: "这里会显示你已保存的已发布优惠。",
    ctaLabel: "打开商品页",
    favoritesCtaLabel: "查看收藏",
    backToHomeLabel: "返回首页",
    missingDealTitle: "优惠不存在",
    missingDealCtaLabel: "返回首页",
    originalPriceLabel: "原价",
    latestDealsTitle: "最新优惠",
    trendingMerchantsTitle: "热门商家",
    localeLabels: {
      en: "English",
      zh: "中文",
    },
  },
};

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return locale === "en" || locale === "zh";
}

export function getLocaleCopy(locale: SupportedLocale) {
  return LOCALE_COPY[locale];
}

function slugifyIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeLiveCategory(category: string): PublicDealCategory {
  const token = category.trim().toLowerCase();

  if (token.includes("gift")) {
    return "gift-card-offers";
  }

  if (token.includes("free")) {
    return "freebies";
  }

  if (token.includes("historical") || token.includes("low")) {
    return "historical-lows";
  }

  return "deals";
}

function formatLivePrice(value: string | undefined) {
  if (!value) {
    return "A$0";
  }

  return value.trim().startsWith("A$") ? value.trim() : `A$${value.trim()}`;
}

interface LiveDealPriceEvidence {
  amountBelowRecentHigh: string | null;
  currentPriceDisplay: string;
  highestTrackedPrice: string | null;
  lowestTrackedPrice: string | null;
  percentBelowRecentHigh: number | null;
}

function parseOptionalMoneyAmount(value: string | undefined) {
  if (!value) {
    return null;
  }

  const amount = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function formatTrackedMoneyAmount(amount: number) {
  return `A$${amount.toFixed(2)}`;
}

function getLiveDealPriceEvidence(
  input: LivePublicDealInput,
  currentPrice: string,
): LiveDealPriceEvidence {
  const currentAmount = parseOptionalMoneyAmount(currentPrice);
  const currentPriceDisplay =
    currentAmount === null ? currentPrice : formatTrackedMoneyAmount(currentAmount);
  const trackedAmounts = (input.priceContext?.snapshots ?? [])
    .map((snapshot) => parseOptionalMoneyAmount(snapshot.price))
    .filter((amount): amount is number => amount !== null);

  if (trackedAmounts.length === 0 || currentAmount === null) {
    return {
      amountBelowRecentHigh: null,
      currentPriceDisplay,
      highestTrackedPrice: null,
      lowestTrackedPrice: null,
      percentBelowRecentHigh: null,
    };
  }

  const highestTrackedAmount = Math.max(...trackedAmounts);
  const lowestTrackedAmount = Math.min(...trackedAmounts);
  const amountBelowRecentHigh = highestTrackedAmount - currentAmount;
  const hasMeaningfulDiscount = amountBelowRecentHigh > 0.009;

  return {
    amountBelowRecentHigh: hasMeaningfulDiscount
      ? formatTrackedMoneyAmount(amountBelowRecentHigh)
      : null,
    currentPriceDisplay,
    highestTrackedPrice: formatTrackedMoneyAmount(highestTrackedAmount),
    lowestTrackedPrice: formatTrackedMoneyAmount(lowestTrackedAmount),
    percentBelowRecentHigh: hasMeaningfulDiscount
      ? Math.round((amountBelowRecentHigh / highestTrackedAmount) * 100)
      : null,
  };
}

function getLiveDealDiscountLabel(
  category: PublicDealCategory,
  activeLocale: SupportedLocale,
  priceEvidence: LiveDealPriceEvidence,
) {
  if (priceEvidence.percentBelowRecentHigh) {
    return activeLocale === "en"
      ? `${priceEvidence.percentBelowRecentHigh}% below tracked high`
      : `比监测高位低 ${priceEvidence.percentBelowRecentHigh}%`;
  }

  return PUBLIC_DEAL_CATEGORY_LABELS[category][activeLocale];
}

function getLiveDealDetail(
  input: LivePublicDealInput,
  priceEvidence: LiveDealPriceEvidence,
): PublicDealDetailMetadata {
  const validFrom = input.publishedAt?.slice(0, 10) || "2026-04-23";
  const merchant = input.merchant || "Unknown merchant";
  const hasTrackedRange =
    priceEvidence.lowestTrackedPrice !== null && priceEvidence.highestTrackedPrice !== null;
  const hasTrackedDiscount =
    priceEvidence.amountBelowRecentHigh !== null && priceEvidence.highestTrackedPrice !== null;

  const englishHighlights = hasTrackedRange
    ? [
        `Tracked range: ${priceEvidence.lowestTrackedPrice} to ${priceEvidence.highestTrackedPrice}.`,
        `Published by ${merchant} on ${validFrom}.`,
      ]
    : [
        `Current listed price: ${priceEvidence.currentPriceDisplay}.`,
        `Published by ${merchant} on ${validFrom}.`,
      ];

  const chineseHighlights = hasTrackedRange
    ? [
        `监测区间：${priceEvidence.lowestTrackedPrice} 至 ${priceEvidence.highestTrackedPrice}。`,
        `由 ${merchant} 于 ${validFrom} 发布。`,
      ]
    : [`当前标价：${priceEvidence.currentPriceDisplay}。`, `由 ${merchant} 于 ${validFrom} 发布。`];

  return {
    couponCode: null,
    endingSoon: false,
    expiresAt: validFrom,
    freeShipping: false,
    validFrom,
    locales: {
      en: {
        validity: `Published on ${validFrom}`,
        whyWorthIt: hasTrackedDiscount
          ? `Current ${priceEvidence.currentPriceDisplay} is ${priceEvidence.amountBelowRecentHigh} below the tracked high of ${priceEvidence.highestTrackedPrice}.`
          : `The current listed price is ${priceEvidence.currentPriceDisplay} at ${merchant}.`,
        highlights: englishHighlights,
        howToGetIt: [
          "Open the merchant page from the deal link.",
          "Confirm the final checkout price and stock before you buy.",
        ],
        termsAndWarnings: [
          hasTrackedRange
            ? "Price comparisons only use the tracked snapshots shown on this page."
            : "No tracked price comparison is available for this deal yet.",
          "Shipping, account limits, and campaign exclusions are set by the merchant.",
        ],
      },
      zh: {
        validity: `发布于 ${validFrom}`,
        whyWorthIt: hasTrackedDiscount
          ? `当前价 ${priceEvidence.currentPriceDisplay} 比监测高位 ${priceEvidence.highestTrackedPrice} 低 ${priceEvidence.amountBelowRecentHigh}。`
          : `当前标价是 ${priceEvidence.currentPriceDisplay}，商家是 ${merchant}。`,
        highlights: chineseHighlights,
        howToGetIt: ["通过优惠链接打开商家页面。", "下单前确认最终价格、库存和活动条件。"],
        termsAndWarnings: [
          hasTrackedRange ? "价格对比仅基于本页展示的监测快照。" : "这条优惠暂时没有可用的价格对比。",
          "配送、账号限制和活动排除项以商家页面为准。",
        ],
      },
    },
  };
}

export function normalizeLivePublicDeal(
  input: LivePublicDealInput,
  activeLocale: SupportedLocale,
): PublicDealRecord {
  const category = normalizeLiveCategory(input.category);
  const merchantName = input.merchant || "Unknown merchant";
  const currentPrice = formatLivePrice(input.currentPrice);
  const priceEvidence = getLiveDealPriceEvidence(input, currentPrice);
  const originalPrice =
    priceEvidence.amountBelowRecentHigh !== null && priceEvidence.highestTrackedPrice
      ? priceEvidence.highestTrackedPrice
      : currentPrice;

  return {
    slug: input.slug,
    categories: [category],
    currentPrice,
    originalPrice,
    discountLabel: getLiveDealDiscountLabel(category, activeLocale, priceEvidence),
    dealUrl: input.affiliateUrl || "#",
    detail: getLiveDealDetail(input, priceEvidence),
    merchant: {
      id: slugifyIdentifier(merchantName) || "unknown-merchant",
      name: merchantName,
    },
    publishedAt: input.publishedAt || "1970-01-01T00:00:00.000Z",
    locales: {
      en: {
        title: input.locale === "zh" && activeLocale === "zh" ? input.title : input.title,
        summary: input.locale === "zh" && activeLocale === "zh" ? input.summary : input.summary,
      },
      zh: {
        title: input.title,
        summary: input.summary,
      },
    },
  };
}

export function shouldIncludeSeededPublicDeals() {
  const explicitMode = process.env.PUBLIC_SEEDED_DEALS_ENABLED?.trim().toLowerCase();

  if (explicitMode === "1" || explicitMode === "true") {
    return true;
  }

  if (explicitMode === "0" || explicitMode === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

export function getDefaultPublicDeals() {
  return shouldIncludeSeededPublicDeals() ? getSeededPublicDeals() : [];
}

export function mergePublicDeals(
  liveDeals: PublicDealRecord[] = [],
  seededDeals: PublicDealRecord[] = getDefaultPublicDeals(),
) {
  const merged = new Map<string, PublicDealRecord>();

  for (const deal of seededDeals) {
    merged.set(deal.slug, deal);
  }

  for (const deal of liveDeals) {
    if (!merged.has(deal.slug)) {
      merged.set(deal.slug, deal);
    }
  }

  return [...merged.values()];
}

export function getPublicDeal(slug: string, deals: PublicDealRecord[] = getDefaultPublicDeals()) {
  return deals.find((deal) => deal.slug === slug) ?? null;
}

export function getSeededPublicDeals(): PublicDealRecord[] {
  return [...PUBLIC_DEALS];
}

function toTimestamp(publishedAt: string) {
  return Date.parse(publishedAt);
}

export function getLatestDeals(limit = 4, deals: PublicDealRecord[] = getDefaultPublicDeals()): PublicDealRecord[] {
  return [...deals]
    .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt))
    .slice(0, limit);
}

export function getTrendingMerchants(
  limit = 4,
  deals: PublicDealRecord[] = getDefaultPublicDeals(),
): TrendingMerchantRecord[] {
  const merchants = new Map<string, TrendingMerchantRecord>();

  for (const deal of deals) {
    const existing = merchants.get(deal.merchant.id);
    if (!existing) {
      merchants.set(deal.merchant.id, {
        id: deal.merchant.id,
        name: deal.merchant.name,
        dealCount: 1,
        latestPublishedAt: deal.publishedAt,
      });
      continue;
    }

    existing.dealCount += 1;
    if (toTimestamp(deal.publishedAt) > toTimestamp(existing.latestPublishedAt)) {
      existing.latestPublishedAt = deal.publishedAt;
    }
  }

  return [...merchants.values()]
    .sort((left, right) => {
      if (right.dealCount !== left.dealCount) {
        return right.dealCount - left.dealCount;
      }

      const publishedAtDiff = toTimestamp(right.latestPublishedAt) - toTimestamp(left.latestPublishedAt);
      if (publishedAtDiff !== 0) {
        return publishedAtDiff;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, limit);
}

export function getHomeSectionsFromDefinitions(
  locale: SupportedLocale,
  sections: HomeSectionDefinition[],
  deals: PublicDealRecord[] = getDefaultPublicDeals(),
): PublicHomeSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.locales[locale],
    deals: section.slugs.map((slug) => {
      const deal = getPublicDeal(slug, deals);
      if (!deal) {
        throw new Error(`Missing public deal slug "${slug}" in home section "${section.id}"`);
      }

      return deal;
    }),
  }));
}

function mapHomeSectionToCategory(sectionId: HomeSectionDefinition["id"]): PublicDealCategory {
  switch (sectionId) {
    case "historical-lows":
    case "freebies":
    case "gift-card-offers":
      return sectionId;
    default:
      return "deals";
  }
}

export function getHomeSections(
  locale: SupportedLocale,
  deals: PublicDealRecord[] = getDefaultPublicDeals(),
  priorityDeals: PublicDealRecord[] = [],
): PublicHomeSection[] {
  return HOME_SECTIONS.map((section) => {
    const category = mapHomeSectionToCategory(section.id);
    const prioritizedMatches = [...priorityDeals]
      .filter((deal) => deal.categories.includes(category))
      .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt))
      .slice(0, 1);

    if (prioritizedMatches.length > 0) {
      return {
        id: section.id,
        title: section.locales[locale],
        deals: prioritizedMatches,
      };
    }

    try {
      return getHomeSectionsFromDefinitions(locale, [section], deals)[0];
    } catch {
      const categoryMatches = [...deals]
        .filter((deal) => deal.categories.includes(category))
        .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt))
        .slice(0, 1);

      if (categoryMatches.length === 0) {
        return null;
      }

      return {
        id: section.id,
        title: section.locales[locale],
        deals: categoryMatches,
      };
    }
  }).filter((section): section is PublicHomeSection => section !== null);
}

export function buildLocaleHref(locale: SupportedLocale, path: string) {
  return `/${locale}${path}`;
}

function toSingleSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || undefined;
  }

  return value?.trim() || undefined;
}

function isDiscountBand(value: string): value is PublicDealDiscountBand {
  return value === "under-20" || value === "20-plus" || value === "free";
}

function parseMoneyAmount(value: string) {
  const amount = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function getPublicDealDiscountBand(deal: PublicDealRecord): PublicDealDiscountBand {
  const currentPrice = parseMoneyAmount(deal.currentPrice);
  const originalPrice = parseMoneyAmount(deal.originalPrice);

  if (currentPrice === 0) {
    return "free";
  }

  if (originalPrice <= 0 || currentPrice >= originalPrice) {
    return "under-20";
  }

  const discountPercent = ((originalPrice - currentPrice) / originalPrice) * 100;
  return discountPercent >= 20 ? "20-plus" : "under-20";
}

export function getListingFiltersFromSearchParams(
  searchParams?: PublicListingFilterSearchParams,
): PublicListingFilters {
  const merchant = toSingleSearchParam(searchParams?.merchant)?.toLowerCase();
  const historicalLowParam = toSingleSearchParam(searchParams?.["historical-low"])?.toLowerCase();
  const discountBandParam = toSingleSearchParam(searchParams?.["discount-band"])?.toLowerCase();
  const freeShippingParam = toSingleSearchParam(searchParams?.["free-shipping"])?.toLowerCase();
  const endingSoonParam = toSingleSearchParam(searchParams?.["ending-soon"])?.toLowerCase();

  return {
    merchant,
    freeShipping: freeShippingParam === "true" ? true : undefined,
    endingSoon: endingSoonParam === "true" ? true : undefined,
    historicalLow: historicalLowParam === "true" ? true : undefined,
    discountBand: discountBandParam && isDiscountBand(discountBandParam) ? discountBandParam : undefined,
  };
}

export function hasActiveListingFilters(filters: PublicListingFilters) {
  return Boolean(
    filters.merchant
      || filters.historicalLow
      || filters.discountBand
      || filters.freeShipping
      || filters.endingSoon,
  );
}

export function getListingFilterQueryParams(filters: PublicListingFilters) {
  return {
    merchant: filters.merchant,
    "historical-low": filters.historicalLow ? "true" : undefined,
    "discount-band": filters.discountBand,
    "free-shipping": filters.freeShipping ? "true" : undefined,
    "ending-soon": filters.endingSoon ? "true" : undefined,
  };
}

export function appendQueryParams(href: string, params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(([, value]) => value);
  if (entries.length === 0) {
    return href;
  }

  const url = new URL(href, "http://local.test");

  for (const [key, value] of entries) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}`;
}

export function appendSessionToken(href: string, sessionToken?: string) {
  return appendQueryParams(href, { sessionToken });
}

export function getLocaleSwitchLinks(
  locale: SupportedLocale,
  slug: string,
  sessionToken?: string,
) {
  return (["en", "zh"] as SupportedLocale[]).map((candidateLocale) => ({
    locale: candidateLocale,
    href: appendSessionToken(buildLocaleHref(candidateLocale, `/deals/${slug}`), sessionToken),
    label: getLocaleCopy(candidateLocale).localeLabels[candidateLocale],
  }));
}

export function getHomeLocaleSwitchLinks(sessionToken?: string) {
  return (["en", "zh"] as SupportedLocale[]).map((candidateLocale) => ({
    locale: candidateLocale,
    href: appendSessionToken(buildLocaleHref(candidateLocale, ""), sessionToken),
    label: getLocaleCopy(candidateLocale).localeLabels[candidateLocale],
  }));
}

const PUBLIC_SITE_NAME = "Aussie Deal Hub";
const DEFAULT_PUBLIC_SITE_URL = "https://aussie-deal-hub.test";

function getPublicSiteBaseUrl() {
  const configuredSiteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? DEFAULT_PUBLIC_SITE_URL;

  return configuredSiteUrl.endsWith("/") ? configuredSiteUrl : `${configuredSiteUrl}/`;
}

function trimLeadingSlash(path: string) {
  return path.startsWith("/") ? path.slice(1) : path;
}

export function getPublicMetadataBase() {
  return new URL(getPublicSiteBaseUrl());
}

export function buildPublicUrl(path: string) {
  return new URL(trimLeadingSlash(path), getPublicSiteBaseUrl()).toString();
}

function buildLocalizedAlternates(
  locale: SupportedLocale,
  pathBuilder: (locale: SupportedLocale) => string,
): Metadata["alternates"] {
  return {
    canonical: buildPublicUrl(pathBuilder(locale)),
    languages: {
      en: buildPublicUrl(pathBuilder("en")),
      zh: buildPublicUrl(pathBuilder("zh")),
    },
  };
}

function buildMetadataTitle(title: string) {
  return `${title} | ${PUBLIC_SITE_NAME}`;
}

export function getPublicCategoryTitle(locale: SupportedLocale, category: PublicDealCategory) {
  const label = PUBLIC_DEAL_CATEGORY_LABELS[category][locale];

  if (locale === "en") {
    return label;
  }

  return label.endsWith("优惠") ? label : `${label}优惠`;
}

function getCategoryMetadataDescription(locale: SupportedLocale, category: PublicDealCategory) {
  const label = PUBLIC_DEAL_CATEGORY_LABELS[category][locale];

  return locale === "en"
    ? `Browse ${label.toLowerCase()} from the published Australian deal feed.`
    : `浏览${label}分类中的已发布澳洲优惠。`;
}

export function buildHomePageMetadata(locale: SupportedLocale): Metadata {
  const copy = getLocaleCopy(locale);

  return {
    title: buildMetadataTitle(copy.homeTitle),
    description: copy.homeIntro,
    alternates: buildLocalizedAlternates(locale, (candidateLocale) =>
      buildLocaleHref(candidateLocale, ""),
    ),
  };
}

export function buildCategoryPageMetadata(
  locale: SupportedLocale,
  category: PublicDealCategory,
): Metadata {
  return {
    title: buildMetadataTitle(getPublicCategoryTitle(locale, category)),
    description: getCategoryMetadataDescription(locale, category),
    alternates: buildLocalizedAlternates(locale, (candidateLocale) =>
      buildLocaleHref(candidateLocale, `/categories/${category}`),
    ),
  };
}

export function buildDealPageMetadata(
  locale: SupportedLocale,
  deal: PublicDealRecord,
): Metadata {
  return {
    title: buildMetadataTitle(deal.locales[locale].title),
    description: deal.locales[locale].summary,
    alternates: buildLocalizedAlternates(locale, (candidateLocale) =>
      buildLocaleHref(candidateLocale, `/deals/${deal.slug}`),
    ),
  };
}

function getLatestPublishedAtForCategory(
  category: PublicDealCategory,
  deals: PublicDealRecord[] = getDefaultPublicDeals(),
) {
  return deals.filter((deal) => deal.categories.includes(category))
    .sort((left, right) => toTimestamp(right.publishedAt) - toTimestamp(left.publishedAt))[0]
    ?.publishedAt;
}

export function buildPublicSitemapEntries(
  liveDeals: PublicDealRecord[] = [],
): MetadataRoute.Sitemap {
  const sitemapDeals = mergePublicDeals(liveDeals);
  const localeEntries: MetadataRoute.Sitemap = (["en", "zh"] as SupportedLocale[]).map(
    (locale) => ({
      url: buildPublicUrl(buildLocaleHref(locale, "")),
      lastModified: getLatestDeals(1, sitemapDeals)[0]?.publishedAt ?? new Date().toISOString(),
    }),
  );
  const categoryEntries: MetadataRoute.Sitemap = PUBLIC_PRIMARY_CATEGORIES.flatMap((category) =>
    (["en", "zh"] as SupportedLocale[]).map((locale) => ({
      url: buildPublicUrl(buildLocaleHref(locale, `/categories/${category}`)),
      lastModified: getLatestPublishedAtForCategory(category, sitemapDeals) ?? new Date().toISOString(),
    })),
  );
  const detailEntries: MetadataRoute.Sitemap = sitemapDeals.flatMap((deal) =>
    (["en", "zh"] as SupportedLocale[]).map((locale) => ({
      url: buildPublicUrl(buildLocaleHref(locale, `/deals/${deal.slug}`)),
      lastModified: deal.publishedAt,
    })),
  );

  return [...localeEntries, ...categoryEntries, ...detailEntries];
}

export function buildPublicRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: buildPublicUrl("/sitemap.xml"),
  };
}
