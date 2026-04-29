import { prisma } from "../client.ts";

export interface PublishedDealRecord {
  id: string;
  locale: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  merchant: string;
  currentPrice: string;
  affiliateUrl: string;
  publishedAt: string;
  locales: Array<{
    locale: string;
    slug: string;
    title: string;
    summary: string;
  }>;
}

export interface PublishDealLocaleInput {
  locale: string;
  slug: string;
  title: string;
  summary: string;
}

export interface PublishDealInput {
  leadId: string;
  merchant: string;
  category: string;
  currentPrice: string;
  affiliateUrl: string;
  locales: PublishDealLocaleInput[];
}

export interface PublishDealResult {
  leadId: string;
  status: string;
  locales: Array<{
    locale: string;
    slug: string;
  }>;
}

export interface PublishedDigestDealRecord {
  category: string;
  id: string;
  merchant: string;
  status: string;
  locales: {
    en: {
      slug: string;
      title: string;
      merchant?: string;
    };
    zh: {
      slug: string;
      title: string;
      merchant?: string;
    };
  };
}

function mapDealLocaleContent(locale: PublishDealLocaleInput) {
  return {
    slug: locale.slug,
    title: locale.title,
    summary: locale.summary,
    bodyMarkdown: locale.summary,
    seoTitle: locale.title,
    seoDescription: locale.summary,
  };
}

function mapPublishedDealLocales(
  locales: Array<{
    locale: string;
    slug: string;
    title: string;
    summary: string;
  }>,
) {
  return locales
    .map((locale) => ({
      locale: locale.locale,
      slug: locale.slug,
      title: locale.title,
      summary: locale.summary,
    }))
    .sort((left, right) => left.locale.localeCompare(right.locale));
}

function mapPublishedDealRecord(row: {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  deal: {
    id: string;
    category: string;
    merchant: string;
    currentPrice: { toString(): string };
    affiliateUrl: string;
    updatedAt: Date;
    status: string;
    locales: Array<{
      locale: string;
      slug: string;
      title: string;
      summary: string;
    }>;
  };
}): PublishedDealRecord | null {
  if (row.deal.status !== "published") {
    return null;
  }

  return {
    id: row.deal.id,
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.deal.category,
    merchant: row.deal.merchant,
    currentPrice: row.deal.currentPrice.toString(),
    affiliateUrl: row.deal.affiliateUrl,
    publishedAt: row.deal.updatedAt.toISOString(),
    locales: mapPublishedDealLocales(row.deal.locales),
  };
}

function getCanonicalPublishedDealSlugFromLocales(
  locales: Array<{
    locale: string;
    slug: string;
  }>,
) {
  return locales.find((locale) => locale.locale === "en")?.slug ?? locales[0]?.slug ?? null;
}

export function createPublishedDealRepository() {
  return {
    async publishDeal(input: PublishDealInput): Promise<PublishDealResult> {
      return prisma.$transaction(async (transaction) => {
        const deal = await transaction.deal.upsert({
          where: {
            leadId: input.leadId,
          },
          create: {
            leadId: input.leadId,
            merchant: input.merchant,
            category: input.category,
            currentPrice: input.currentPrice,
            affiliateUrl: input.affiliateUrl,
            status: "published",
          },
          update: {
            merchant: input.merchant,
            category: input.category,
            currentPrice: input.currentPrice,
            affiliateUrl: input.affiliateUrl,
            status: "published",
          },
          select: {
            id: true,
            leadId: true,
            status: true,
          },
        });

        for (const locale of input.locales) {
          await transaction.dealLocale.upsert({
            where: {
              dealId_locale: {
                dealId: deal.id,
                locale: locale.locale,
              },
            },
            create: {
              dealId: deal.id,
              locale: locale.locale,
              ...mapDealLocaleContent(locale),
            },
            update: mapDealLocaleContent(locale),
          });
        }

        const locales = await transaction.dealLocale.findMany({
          where: {
            dealId: deal.id,
          },
          orderBy: {
            locale: "asc",
          },
          select: {
            locale: true,
            slug: true,
          },
        });

        return {
          leadId: deal.leadId,
          status: deal.status,
          locales,
        };
      });
    },

    async getPublishedDeal(locale: string, slug: string): Promise<PublishedDealRecord | null> {
      const row = await prisma.dealLocale.findUnique({
        where: {
          slug,
        },
        select: {
          locale: true,
          slug: true,
          title: true,
          summary: true,
          deal: {
            select: {
              id: true,
              category: true,
              merchant: true,
              currentPrice: true,
              affiliateUrl: true,
              updatedAt: true,
              status: true,
              locales: {
                orderBy: {
                  locale: "asc",
                },
                select: {
                  locale: true,
                  slug: true,
                  title: true,
                  summary: true,
                },
              },
            },
          },
        },
      });

      if (!row || row.locale !== locale) {
        return null;
      }

      return mapPublishedDealRecord(row);
    },

    async listPublishedDeals(locale: string): Promise<PublishedDealRecord[]> {
      const deals = await prisma.deal.findMany({
        where: {
          status: "published",
          locales: {
            some: {
              locale,
            },
          },
        },
        orderBy: [
          {
            updatedAt: "desc",
          },
          {
            id: "asc",
          },
        ],
        select: {
          id: true,
          category: true,
          merchant: true,
          currentPrice: true,
          affiliateUrl: true,
          updatedAt: true,
          status: true,
          locales: {
            orderBy: {
              locale: "asc",
            },
            select: {
              locale: true,
              slug: true,
              title: true,
              summary: true,
            },
          },
        },
      });

      return deals
        .flatMap((deal) =>
          deal.locales
            .filter((dealLocale) => dealLocale.locale === locale)
            .flatMap((dealLocale) => {
            const mappedDeal = mapPublishedDealRecord({
              ...dealLocale,
              deal,
            });

            return mappedDeal ? [mappedDeal] : [];
            }),
        )
        .sort((left, right) => {
          const publishedAtDiff = right.publishedAt.localeCompare(left.publishedAt);

          if (publishedAtDiff !== 0) {
            return publishedAtDiff;
          }

          return left.slug.localeCompare(right.slug);
        });
    },

    async listPublishedDealsForDigest(): Promise<PublishedDigestDealRecord[]> {
      const deals = await prisma.deal.findMany({
        where: {
          status: "published",
          locales: {
            some: {
              locale: "en",
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          category: true,
          id: true,
          merchant: true,
          status: true,
          locales: {
            where: {
              locale: {
                in: ["en", "zh"],
              },
            },
            select: {
              locale: true,
              slug: true,
              title: true,
            },
          },
        },
      });

      return deals.flatMap((deal) => {
        const englishLocale = deal.locales.find((locale) => locale.locale === "en");
        const chineseLocale = deal.locales.find((locale) => locale.locale === "zh");

        if (!englishLocale || !chineseLocale) {
          return [];
        }

        return [
          {
            category: deal.category,
            id: deal.id,
            merchant: deal.merchant,
            status: deal.status,
            locales: {
              en: {
                slug: englishLocale.slug,
                title: englishLocale.title,
                merchant: deal.merchant,
              },
              zh: {
                slug: chineseLocale.slug,
                title: chineseLocale.title,
              },
            },
          },
        ];
      });
    },

    async hasPublishedDealSlug(slug: string): Promise<boolean> {
      const row = await prisma.dealLocale.findFirst({
        where: {
          slug,
          deal: {
            status: "published",
          },
        },
        select: {
          id: true,
        },
      });

      return Boolean(row);
    },

    async getCanonicalPublishedDealSlug(slug: string): Promise<string | null> {
      const row = await prisma.dealLocale.findFirst({
        where: {
          slug,
          deal: {
            status: "published",
          },
        },
        select: {
          deal: {
            select: {
              locales: {
                orderBy: {
                  locale: "asc",
                },
                select: {
                  locale: true,
                  slug: true,
                },
              },
            },
          },
        },
      });

      return row ? getCanonicalPublishedDealSlugFromLocales(row.deal.locales) : null;
    },

    async listEquivalentPublishedDealSlugs(slug: string): Promise<string[]> {
      const row = await prisma.dealLocale.findFirst({
        where: {
          slug,
          deal: {
            status: "published",
          },
        },
        select: {
          deal: {
            select: {
              locales: {
                orderBy: {
                  locale: "asc",
                },
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      });

      return row ? [...new Set(row.deal.locales.map((locale) => locale.slug))] : [];
    },

    async getPublishedDealSlugForLead(leadId: string, locale: string): Promise<string | null> {
      const row = await prisma.dealLocale.findFirst({
        where: {
          locale,
          deal: {
            leadId,
          },
        },
        select: {
          slug: true,
        },
      });

      return row?.slug ?? null;
    },
  };
}
