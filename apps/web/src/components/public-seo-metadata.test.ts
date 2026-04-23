import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
  });

  afterEach(() => {
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
      description: "浏览历史低价分类中的 seeded public 澳洲优惠。",
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

  it("publishes sitemap entries for locale homes, primary categories, and seeded deal details", async () => {
    const sitemapModule = await import("../app/sitemap");

    expect(sitemapModule.default).toBeTypeOf("function");

    const entries = await sitemapModule.default();
    const urls = entries.map((entry) => entry.url);
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
      ]),
    );
    expect(urls.every((url) => !url.includes("sessionToken"))).toBe(true);
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
