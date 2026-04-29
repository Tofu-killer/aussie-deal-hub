import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPublicDealFromApiWithLocaleFallback,
  listPublicDeals,
  listPublicDealsWithLocaleFallback,
} from "../lib/serverApi";

vi.mock("../lib/serverApi", () => ({
  getPublicDealFromApi: vi.fn(),
  getPublicDealFromApiWithLocaleFallback: vi.fn(),
  listPriceSnapshots: vi.fn(),
  listPublicDeals: vi.fn(),
  listPublicDealsWithLocaleFallback: vi.fn(),
}));

const SITE_URL = "https://deals.example";
const CATEGORY_URLS = [
  "/categories/deals",
  "/categories/historical-lows",
  "/categories/freebies",
  "/categories/gift-card-offers",
];
const DEAL_SLUGS = [
  "nintendo-switch-oled-amazon-au",
  "airpods-pro-2-costco-au",
  "epic-game-freebie-week",
  "coles-gift-card-bonus-credit",
];

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

describe("public SEO metadata and discovery files", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = SITE_URL;
    vi.mocked(listPublicDeals).mockResolvedValue([]);
    vi.mocked(listPublicDealsWithLocaleFallback).mockResolvedValue([]);
    vi.mocked(getPublicDealFromApiWithLocaleFallback).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();

    if (originalSiteUrl) {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
      return;
    }

    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it("exposes metadataBase from the locale layout", async () => {
    const layoutModule = await import("../app/[locale]/layout");

    expect(layoutModule.metadata).toMatchObject({
      metadataBase: new URL(SITE_URL),
    });
  });

  it("returns localized home metadata with canonical and en/zh alternates", async () => {
    const pageModule = await import("../app/[locale]/page");

    expect(pageModule.generateMetadata).toBeTypeOf("function");

    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata).toMatchObject({
      title: "Today's picks | Aussie Deal Hub",
      description:
        "Browse bilingual Australian deals with a clear price hierarchy and fast merchant CTA.",
      alternates: {
        canonical: `${SITE_URL}/en`,
        languages: {
          en: `${SITE_URL}/en`,
          zh: `${SITE_URL}/zh`,
        },
      },
    });
  });

  it("returns localized category metadata with canonical and en/zh alternates", async () => {
    const categoryModule = await import("../app/[locale]/categories/[category]/page");

    expect(categoryModule.generateMetadata).toBeTypeOf("function");

    const metadata = await categoryModule.generateMetadata({
      params: Promise.resolve({ locale: "zh", category: "historical-lows" }),
    });
    const dealsMetadata = await categoryModule.generateMetadata({
      params: Promise.resolve({ locale: "zh", category: "deals" }),
    });

    expect(metadata).toMatchObject({
      title: "历史低价优惠 | Aussie Deal Hub",
      description: "浏览历史低价分类中的已发布澳洲优惠。",
      alternates: {
        canonical: `${SITE_URL}/zh/categories/historical-lows`,
        languages: {
          en: `${SITE_URL}/en/categories/historical-lows`,
          zh: `${SITE_URL}/zh/categories/historical-lows`,
        },
      },
    });
    expect(dealsMetadata.title).toBe("优惠 | Aussie Deal Hub");
  });

  it("returns merchant-aware category metadata, keeps content-shaping filters, and strips session noise from canonical URLs", async () => {
    const categoryModule = await import("../app/[locale]/categories/[category]/page");

    expect(categoryModule.generateMetadata).toBeTypeOf("function");

    const metadata = await categoryModule.generateMetadata({
      params: Promise.resolve({ locale: "en", category: "historical-lows" }),
      searchParams: Promise.resolve({
        merchant: "amazon-au",
        "discount-band": "20-plus",
        "free-shipping": "true",
        sessionToken: "session_123",
      }),
    });

    expect(metadata).toMatchObject({
      title: "Amazon AU historical lows | Aussie Deal Hub",
      description:
        "Browse published historical lows from Amazon AU with merchant-aware filters and bilingual summaries.",
      alternates: {
        canonical:
          `${SITE_URL}/en/categories/historical-lows?merchant=amazon-au&discount-band=20-plus&free-shipping=true`,
        languages: {
          en:
            `${SITE_URL}/en/categories/historical-lows?merchant=amazon-au&discount-band=20-plus&free-shipping=true`,
          zh:
            `${SITE_URL}/zh/categories/historical-lows?merchant=amazon-au&discount-band=20-plus&free-shipping=true`,
        },
      },
    });
  });

  it("keeps unknown merchant category metadata stable across locale alternates", async () => {
    const categoryModule = await import("../app/[locale]/categories/[category]/page");

    const metadata = await categoryModule.generateMetadata({
      params: Promise.resolve({ locale: "zh", category: "freebies" }),
      searchParams: Promise.resolve({
        merchant: "unknown-merchant",
      }),
    });

    expect(metadata).toMatchObject({
      title: "未知商家（unknown-merchant） 免费领取优惠 | Aussie Deal Hub",
      description: "浏览未知商家（unknown-merchant）的已发布免费领取优惠，并可继续按筛选收紧列表。",
      alternates: {
        canonical: `${SITE_URL}/zh/categories/freebies?merchant=unknown-merchant`,
        languages: {
          en: `${SITE_URL}/en/categories/freebies?merchant=unknown-merchant`,
          zh: `${SITE_URL}/zh/categories/freebies?merchant=unknown-merchant`,
        },
      },
    });
  });

  it("returns merchant-aware search metadata, keeps content-shaping filters, and strips session noise from canonical URLs", async () => {
    const searchModule = await import("../app/[locale]/search/page");

    expect(searchModule.generateMetadata).toBeTypeOf("function");

    const metadata = await searchModule.generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        q: "Amazon AU",
        merchant: "amazon-au",
        "discount-band": "20-plus",
        sessionToken: "session_123",
      }),
    });

    expect(metadata).toMatchObject({
      title: "Amazon AU deals | Aussie Deal Hub",
      description:
        "Browse published deals from Amazon AU with merchant-aware filters and bilingual summaries.",
      alternates: {
        canonical: `${SITE_URL}/en/search?merchant=amazon-au&discount-band=20-plus`,
        languages: {
          en: `${SITE_URL}/en/search?merchant=amazon-au&discount-band=20-plus`,
          zh: `${SITE_URL}/zh/search?merchant=amazon-au&discount-band=20-plus`,
        },
      },
    });
  });

  it("keeps distinct merchant search keywords in localized canonical URLs", async () => {
    const searchModule = await import("../app/[locale]/search/page");

    const metadata = await searchModule.generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        q: "switch",
        merchant: "amazon-au",
      }),
    });

    expect(metadata).toMatchObject({
      title: "Amazon AU deals | Aussie Deal Hub",
      description: 'Browse published deals from Amazon AU matching "switch".',
      alternates: {
        canonical: `${SITE_URL}/en/search?merchant=amazon-au&q=switch`,
        languages: {
          en: `${SITE_URL}/en/search?merchant=amazon-au&q=switch`,
          zh: `${SITE_URL}/zh/search?merchant=amazon-au&q=switch`,
        },
      },
    });
  });

  it("keeps unknown merchant search metadata stable across locale alternates", async () => {
    const searchModule = await import("../app/[locale]/search/page");

    const metadata = await searchModule.generateMetadata({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        merchant: "unknown-merchant",
      }),
    });

    expect(metadata).toMatchObject({
      title: "Unknown merchant (unknown-merchant) deals | Aussie Deal Hub",
      description:
        "Browse published deals from Unknown merchant (unknown-merchant) with merchant-aware filters and bilingual summaries.",
      alternates: {
        canonical: `${SITE_URL}/en/search?merchant=unknown-merchant`,
        languages: {
          en: `${SITE_URL}/en/search?merchant=unknown-merchant`,
          zh: `${SITE_URL}/zh/search?merchant=unknown-merchant`,
        },
      },
    });
  });

  it("returns localized detail metadata with canonical and en/zh alternates", async () => {
    const detailModule = await import("../app/[locale]/deals/[slug]/page");

    expect(detailModule.generateMetadata).toBeTypeOf("function");

    const metadata = await detailModule.generateMetadata({
      params: Promise.resolve({
        locale: "en",
        slug: "nintendo-switch-oled-amazon-au",
      }),
    });

    expect(metadata).toMatchObject({
      title: "Nintendo Switch OLED for A$399 at Amazon AU | Aussie Deal Hub",
      description: "Coupon GAME20 drops the OLED model to a strong Amazon AU price.",
      alternates: {
        canonical: `${SITE_URL}/en/deals/nintendo-switch-oled-amazon-au`,
        languages: {
          en: `${SITE_URL}/en/deals/nintendo-switch-oled-amazon-au`,
          zh: `${SITE_URL}/zh/deals/nintendo-switch-oled-amazon-au`,
        },
      },
    });
  });

  it("returns localized detail metadata when a zh page falls back to an en-only live deal", async () => {
    vi.mocked(getPublicDealFromApiWithLocaleFallback).mockResolvedValue({
      slug: "live-only-weekend-bundle",
      title: "Weekend bundle for A$179 at JB Hi-Fi",
      summary: "Live catalog weekend bundle with pickup available.",
      category: "deals",
      locale: "en",
      merchant: "JB Hi-Fi",
      currentPrice: "179",
      publishedAt: "2026-04-23T10:00:00.000Z",
    });

    const detailModule = await import("../app/[locale]/deals/[slug]/page");

    const metadata = await detailModule.generateMetadata({
      params: Promise.resolve({
        locale: "zh",
        slug: "live-only-weekend-bundle",
      }),
    });

    expect(metadata).toMatchObject({
      title: "JB Hi-Fi 当前优惠：Weekend bundle for A$179 at JB Hi-Fi | Aussie Deal Hub",
      description:
        "当前标价 A$179.00，商家是 JB Hi-Fi。商家原文：Live catalog weekend bundle with pickup available.",
      alternates: {
        canonical: `${SITE_URL}/zh/deals/live-only-weekend-bundle`,
        languages: {
          en: `${SITE_URL}/en/deals/live-only-weekend-bundle`,
          zh: `${SITE_URL}/zh/deals/live-only-weekend-bundle`,
        },
      },
    });
  });

  it("uses locale-specific alternate slugs and translated live copy when sibling locale content exists", async () => {
    vi.mocked(getPublicDealFromApiWithLocaleFallback).mockResolvedValue({
      id: "deal_live_lego_1",
      slug: "lego-bonsai-tree-for-a-59-at-big-w",
      title: "LEGO Bonsai Tree for A$59 at Big W",
      summary: "Stacked voucher pricing lands the bonsai set at A$59.",
      category: "deals",
      locale: "en",
      merchant: "Big W",
      currentPrice: "59",
      publishedAt: "2026-04-23T10:00:00.000Z",
      locales: [
        {
          locale: "en",
          slug: "lego-bonsai-tree-for-a-59-at-big-w",
          title: "LEGO Bonsai Tree for A$59 at Big W",
          summary: "Stacked voucher pricing lands the bonsai set at A$59.",
        },
        {
          locale: "zh",
          slug: "big-w-乐高盆景树套装-a-59",
          title: "Big W 乐高盆景树套装 A$59",
          summary: "叠加优惠后乐高盆景树套装到手 A$59。",
        },
      ],
    });

    const detailModule = await import("../app/[locale]/deals/[slug]/page");

    const metadata = await detailModule.generateMetadata({
      params: Promise.resolve({
        locale: "zh",
        slug: "big-w-乐高盆景树套装-a-59",
      }),
    });

    expect(metadata).toMatchObject({
      title: "Big W 乐高盆景树套装 A$59 | Aussie Deal Hub",
      description: "叠加优惠后乐高盆景树套装到手 A$59。",
      alternates: {
        canonical: `${SITE_URL}/zh/deals/big-w-%E4%B9%90%E9%AB%98%E7%9B%86%E6%99%AF%E6%A0%91%E5%A5%97%E8%A3%85-a-59`,
        languages: {
          en: `${SITE_URL}/en/deals/lego-bonsai-tree-for-a-59-at-big-w`,
          zh: `${SITE_URL}/zh/deals/big-w-%E4%B9%90%E9%AB%98%E7%9B%86%E6%99%AF%E6%A0%91%E5%A5%97%E8%A3%85-a-59`,
        },
      },
    });
  });

  it("publishes sitemap entries for locale homes, primary categories, and seeded deal details", async () => {
    vi.mocked(listPublicDeals).mockResolvedValue([
      {
        slug: "live-only-coffee-subscription",
        category: "deals",
        currentPrice: "19",
        locale: "en",
        merchant: "Live Roasters",
        publishedAt: "2026-04-23T11:00:00.000Z",
        summary: "Live-only catalog deal.",
        title: "Live-only coffee subscription",
      },
    ]);

    const sitemapModule = await import("../app/sitemap");

    expect(sitemapModule.default).toBeTypeOf("function");

    const entries = await sitemapModule.default();
    const urls = entries.map((entry) => entry.url);
    const enHomeEntry = entries.find((entry) => entry.url === `${SITE_URL}/en`);
    const zhHomeEntry = entries.find((entry) => entry.url === `${SITE_URL}/zh`);
    const enDealsCategory = entries.find(
      (entry) => entry.url === `${SITE_URL}/en/categories/deals`,
    );
    const zhFreebiesCategory = entries.find(
      (entry) => entry.url === `${SITE_URL}/zh/categories/freebies`,
    );
    const enGiftCardCategory = entries.find(
      (entry) => entry.url === `${SITE_URL}/en/categories/gift-card-offers`,
    );

    expect(urls).toEqual(
      expect.arrayContaining([
        `${SITE_URL}/en`,
        `${SITE_URL}/zh`,
        ...CATEGORY_URLS.flatMap((path) => [`${SITE_URL}/en${path}`, `${SITE_URL}/zh${path}`]),
        ...DEAL_SLUGS.flatMap((slug) => [
          `${SITE_URL}/en/deals/${slug}`,
          `${SITE_URL}/zh/deals/${slug}`,
        ]),
        `${SITE_URL}/en/deals/live-only-coffee-subscription`,
        `${SITE_URL}/zh/deals/live-only-coffee-subscription`,
      ]),
    );
    expect(urls.every((url) => !url.includes("sessionToken"))).toBe(true);
    expect(enHomeEntry?.lastModified).toBe("2026-04-23T11:00:00.000Z");
    expect(zhHomeEntry?.lastModified).toBe("2026-04-23T11:00:00.000Z");
    expect(enDealsCategory?.lastModified).toBe("2026-04-23T11:00:00.000Z");
    expect(zhFreebiesCategory?.lastModified).toBe("2026-04-20T09:00:00.000Z");
    expect(enGiftCardCategory?.lastModified).toBe("2026-04-19T09:00:00.000Z");
  });

  it("publishes robots rules that point crawlers at the sitemap", async () => {
    const robotsModule = await import("../app/robots");

    expect(robotsModule.default).toBeTypeOf("function");

    const robots = await robotsModule.default();

    expect(robots).toMatchObject({
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: `${SITE_URL}/sitemap.xml`,
    });
  });
});
