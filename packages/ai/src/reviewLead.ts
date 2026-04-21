export interface ReviewableLead {
  originalTitle: string;
  snippet: string;
}

export interface ReviewLocale {
  title: string;
  summary: string;
}

export interface LeadReview {
  category: "Deals" | "Historical Lows" | "Freebies" | "Gift Card Offers";
  confidence: number;
  riskLabels: string[];
  locales: {
    en: ReviewLocale;
    zh: ReviewLocale;
  };
}

const MERCHANT_TRANSLATIONS: Record<string, string> = {
  "Amazon AU": "亚马逊澳洲",
};
const KNOWN_MERCHANTS = [
  "Amazon AU",
  "eBay",
  "JB Hi-Fi",
  "Harvey Norman",
  "The Good Guys",
  "Big W",
  "Officeworks",
  "Chemist Warehouse",
  "David Jones",
  "Myer",
  "Bunnings",
  "Kogan",
  "Bing Lee",
  "Woolworths",
  "Coles",
];

function detectCategory(input: ReviewableLead): LeadReview["category"] {
  const text = `${input.originalTitle} ${input.snippet}`.toLowerCase();

  if (
    text.includes("historical low") ||
    text.includes("near historical low") ||
    text.includes("all time low") ||
    text.includes("record low")
  ) {
    return "Historical Lows";
  }

  if (text.includes("gift card")) {
    return "Gift Card Offers";
  }

  if (text.includes("freebie") || /\bfree\b(?!\s+shipping)/u.test(text)) {
    return "Freebies";
  }

  return "Deals";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function extractMerchant(originalTitle: string) {
  for (const merchant of KNOWN_MERCHANTS) {
    if (
      originalTitle.startsWith(`${merchant}:`) ||
      originalTitle.startsWith(`${merchant} `) ||
      originalTitle === merchant
    ) {
      return merchant;
    }
  }

  const [merchantCandidate] = originalTitle.split(/:\s*|\s+-\s+/u);

  if (merchantCandidate && merchantCandidate !== originalTitle) {
    return merchantCandidate.trim();
  }

  const beforePrice = originalTitle.replace(/\s+A\$\d+(?:\.\d{2})?.*$/u, "").trim();
  const [singleWordMerchant] = beforePrice.split(/\s+/u);

  return singleWordMerchant?.trim() || "Featured Merchant";
}

function extractPrice(originalTitle: string) {
  return originalTitle.match(/A\$\d+(?:\.\d{2})?/u)?.[0] ?? "A$0";
}

function extractProduct(originalTitle: string, merchant: string, price: string) {
  const merchantPrefix = new RegExp(`^${escapeRegex(merchant)}(?::)?\\s*`, "u");

  return originalTitle
    .replace(merchantPrefix, "")
    .replace(/^-\s*/u, "")
    .replace(/\s+with\s+code\s+\S+$/iu, "")
    .replace(new RegExp(`\\s+for\\s+${escapeRegex(price)}$`, "u"), "")
    .replace(new RegExp(`\\s+${escapeRegex(price)}$`, "u"), "")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildChineseSummary(
  snippet: string,
  translatedMerchant: string,
  product: string,
  price: string,
) {
  const trimmedSnippet = snippet.trim();

  if (trimmedSnippet.length === 0) {
    return `${translatedMerchant} 的 ${product} 价格来到 ${price}。`;
  }

  const couponExpiresTonight = trimmedSnippet.match(/^Coupon\s+(\S+)\s+expires tonight\.?$/iu);

  if (couponExpiresTonight) {
    return `优惠码 ${couponExpiresTonight[1]} 今晚到期。`;
  }

  return `${translatedMerchant} 的 ${product} 价格来到 ${price}。`;
}

export function reviewLead(input: ReviewableLead): LeadReview {
  const merchant = extractMerchant(input.originalTitle);
  const price = extractPrice(input.originalTitle);
  const product = extractProduct(input.originalTitle, merchant, price);
  const translatedMerchant = MERCHANT_TRANSLATIONS[merchant] ?? merchant;

  return {
    category: detectCategory(input),
    confidence: 88,
    riskLabels: [],
    locales: {
      en: {
        title: `${product} for ${price} at ${merchant}`,
        summary: input.snippet || `${product} is available at ${merchant} for ${price}.`,
      },
      zh: {
        title: `${translatedMerchant} ${product} 到手 ${price}`,
        summary: buildChineseSummary(input.snippet, translatedMerchant, product, price),
      },
    },
  };
}
