export type SupportedLocale = "en" | "zh";

interface LocaleCopy {
  currentPriceLabel: string;
  ctaLabel: string;
  favoritesCtaLabel: string;
  backToHomeLabel: string;
  favoritesTitle: string;
  favoritesSummary: string;
  homeIntro: string;
  homeTitle: string;
  localeLabels: Record<SupportedLocale, string>;
  missingDealTitle: string;
  missingDealCtaLabel: string;
  originalPriceLabel: string;
}

interface LocalizedDealContent {
  summary: string;
  title: string;
}

interface PublicDealRecord {
  currentPrice: string;
  dealUrl: string;
  discountLabel: string;
  locales: Record<SupportedLocale, LocalizedDealContent>;
  originalPrice: string;
  slug: string;
}

export const DEFAULT_DEAL: PublicDealRecord = {
  slug: "nintendo-switch-oled-amazon-au",
  currentPrice: "A$399",
  originalPrice: "A$469",
  discountLabel: "15% off",
  dealUrl: "https://www.amazon.com.au/deal",
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

const LOCALE_COPY: Record<SupportedLocale, LocaleCopy> = {
  en: {
    currentPriceLabel: "Current price",
    homeTitle: "Today's picks",
    homeIntro: "Browse bilingual Australian deals with a clear price hierarchy and fast merchant CTA.",
    favoritesTitle: "My Favorites",
    favoritesSummary: "Saved deals will appear here once login and favorites are wired up.",
    ctaLabel: "Go to Deal",
    favoritesCtaLabel: "Open Favorites",
    backToHomeLabel: "Back to home",
    missingDealTitle: "Deal not found",
    missingDealCtaLabel: "Return home",
    originalPriceLabel: "Original price",
    localeLabels: {
      en: "English",
      zh: "中文",
    },
  },
  zh: {
    currentPriceLabel: "当前价格",
    homeTitle: "今日精选",
    homeIntro: "用清晰的价格层级和直接跳转按钮浏览双语澳洲优惠。",
    favoritesTitle: "我的收藏",
    favoritesSummary: "登录和收藏能力接入后，已保存的优惠会显示在这里。",
    ctaLabel: "前往购买",
    favoritesCtaLabel: "查看收藏",
    backToHomeLabel: "返回首页",
    missingDealTitle: "优惠不存在",
    missingDealCtaLabel: "返回首页",
    originalPriceLabel: "原价",
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

export function getPublicDeal(slug: string) {
  if (slug === DEFAULT_DEAL.slug) {
    return DEFAULT_DEAL;
  }

  return null;
}

export function buildLocaleHref(locale: SupportedLocale, path: string) {
  return `/${locale}${path}`;
}

export function getLocaleSwitchLinks(locale: SupportedLocale, slug: string) {
  return (["en", "zh"] as SupportedLocale[]).map((candidateLocale) => ({
    locale: candidateLocale,
    href: buildLocaleHref(candidateLocale, `/deals/${slug}`),
    label: getLocaleCopy(candidateLocale).localeLabels[candidateLocale],
  }));
}

export function getHomeLocaleSwitchLinks() {
  return (["en", "zh"] as SupportedLocale[]).map((candidateLocale) => ({
    locale: candidateLocale,
    href: buildLocaleHref(candidateLocale, ""),
    label: getLocaleCopy(candidateLocale).localeLabels[candidateLocale],
  }));
}
