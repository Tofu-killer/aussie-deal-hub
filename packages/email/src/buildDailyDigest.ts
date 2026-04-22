export interface DailyDigestDeal {
  title: string;
  merchant: string;
}

export interface DailyDigest {
  subject: string;
  html: string;
}

const DIGEST_COPY = {
  en: {
    subject: "Daily Deals Digest",
    intro: "Today&apos;s picks",
  },
  zh: {
    subject: "每日捡漏摘要",
    intro: "今日精选",
  },
} as const;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildDailyDigest(
  locale: keyof typeof DIGEST_COPY,
  deals: DailyDigestDeal[],
): DailyDigest {
  const copy = DIGEST_COPY[locale];
  const groups = new Map<string, DailyDigestDeal[]>();

  for (const deal of deals) {
    const bucket = groups.get(deal.merchant) ?? [];
    bucket.push(deal);
    groups.set(deal.merchant, bucket);
  }

  const sections = Array.from(groups.entries())
    .map(([merchant, merchantDeals]) => {
      const items = merchantDeals
        .map((deal) => `<li><strong>${escapeHtml(deal.title)}</strong></li>`)
        .join("");

      return `<section><h2>${escapeHtml(merchant)}</h2><ul>${items}</ul></section>`;
    })
    .join("");

  return {
    subject: copy.subject,
    html: `<section><h1>${copy.intro}</h1>${sections}</section>`,
  };
}
