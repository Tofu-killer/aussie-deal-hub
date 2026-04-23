import { Router } from "express";
import { reviewLead } from "@aussie-deal-hub/ai/reviewLead";

interface ReviewPreviewInput {
  originalTitle: string;
  snippet: string;
}

type DigestLocale = "en" | "zh";

interface DigestPreviewDeal {
  id: string;
  merchant: string;
  title: string;
}

interface DigestPreviewFixture {
  id: string;
  locales: Record<DigestLocale, Omit<DigestPreviewDeal, "id">>;
}

const DIGEST_PREVIEW_FIXTURES: DigestPreviewFixture[] = [
  {
    id: "nintendo-switch-oled-amazon-au",
    locales: {
      en: {
        merchant: "Amazon AU",
        title: "Nintendo Switch OLED for A$399 at Amazon AU",
      },
      zh: {
        merchant: "亚马逊澳洲",
        title: "亚马逊澳洲 Nintendo Switch OLED 到手 A$399",
      },
    },
  },
  {
    id: "kindle-paperwhite-amazon-au",
    locales: {
      en: {
        merchant: "Amazon AU",
        title: "Kindle Paperwhite for A$179 at Amazon AU",
      },
      zh: {
        merchant: "亚马逊澳洲",
        title: "亚马逊澳洲 Kindle Paperwhite 到手 A$179",
      },
    },
  },
  {
    id: "dyson-v8-the-good-guys",
    locales: {
      en: {
        merchant: "The Good Guys",
        title: "Dyson V8 for A$499 at The Good Guys",
      },
      zh: {
        merchant: "The Good Guys",
        title: "The Good Guys Dyson V8 到手 A$499",
      },
    },
  },
];

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isReviewPreviewInput(value: unknown): value is ReviewPreviewInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return isNonEmptyString(candidate.originalTitle) && typeof candidate.snippet === "string";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildDigestPreviewHtml(locale: DigestLocale, deals: DigestPreviewDeal[]) {
  const copy = DIGEST_COPY[locale];
  const groups = new Map<string, DigestPreviewDeal[]>();

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

function buildDigestPreviewLocale(locale: DigestLocale) {
  const deals = DIGEST_PREVIEW_FIXTURES.map((fixture) => ({
    id: fixture.id,
    ...fixture.locales[locale],
  }));
  const digest = buildDigestPreviewHtml(locale, deals);

  return {
    locale,
    subject: digest.subject,
    html: digest.html,
    deals,
  };
}

export function createAdminPreviewRouter() {
  const router = Router();

  router.post("/review-preview", (request, response) => {
    const input = request.body as ReviewPreviewInput | undefined;

    if (!isReviewPreviewInput(input)) {
      response.status(400).json({ message: "Lead payload is invalid." });
      return;
    }

    response.json(
      reviewLead({
        originalTitle: input.originalTitle,
        snippet: input.snippet,
      }),
    );
  });

  router.get("/digest-preview", (_request, response) => {
    response.json({
      en: buildDigestPreviewLocale("en"),
      zh: buildDigestPreviewLocale("zh"),
    });
  });

  return router;
}
