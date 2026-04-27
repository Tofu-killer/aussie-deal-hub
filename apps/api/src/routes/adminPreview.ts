import { Router } from "express";
import { reviewLead } from "@aussie-deal-hub/ai/reviewLead";
import { buildDailyDigest } from "../../../../packages/email/src/buildDailyDigest.ts";
import { resolveLeadReviewInput } from "./adminLeads.ts";
import type { PublishedDealListReader } from "./publicDeals.ts";

interface ReviewPreviewInput {
  originalTitle: string;
  snippet: string;
  sourceSnapshot?: string | null;
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

  return (
    typeof candidate.originalTitle === "string" &&
    typeof candidate.snippet === "string" &&
    (candidate.sourceSnapshot === undefined ||
      candidate.sourceSnapshot === null ||
      typeof candidate.sourceSnapshot === "string")
  );
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
  const digest = buildDailyDigest(
    locale,
    deals.map((deal) => ({
      merchant: deal.merchant,
      title: deal.title,
    })),
  );

  return {
    subject: digest.subject,
    html: digest.html,
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

async function buildPublishedDigestPreviewLocale(
  locale: DigestLocale,
  publishedDealStore: Pick<PublishedDealListReader, "listPublishedDeals">,
) {
  const deals = (await publishedDealStore.listPublishedDeals(locale)).slice(0, 12).map((deal) => ({
    id: deal.slug,
    merchant: deal.merchant ?? "Unknown merchant",
    title: deal.title,
  }));
  const digest = buildDigestPreviewHtml(locale, deals);

  return {
    locale,
    subject: digest.subject,
    html: digest.html,
    deals,
  };
}

export function createAdminPreviewRouter(
  publishedDealStore?: Pick<PublishedDealListReader, "listPublishedDeals">,
) {
  const router = Router();

  router.post("/review-preview", (request, response) => {
    const input = request.body as ReviewPreviewInput | undefined;

    if (!isReviewPreviewInput(input)) {
      response.status(400).json({ message: "Lead payload is invalid." });
      return;
    }

    const reviewInput = resolveLeadReviewInput(input);

    if (!isNonEmptyString(reviewInput.originalTitle)) {
      response.status(400).json({ message: "Lead payload is invalid." });
      return;
    }

    response.json(reviewLead(reviewInput));
  });

  router.get("/digest-preview", async (_request, response) => {
    if (publishedDealStore?.listPublishedDeals) {
      response.json({
        en: await buildPublishedDigestPreviewLocale("en", publishedDealStore),
        zh: await buildPublishedDigestPreviewLocale("zh", publishedDealStore),
      });
      return;
    }

    response.json({
      en: buildDigestPreviewLocale("en"),
      zh: buildDigestPreviewLocale("zh"),
    });
  });

  return router;
}
