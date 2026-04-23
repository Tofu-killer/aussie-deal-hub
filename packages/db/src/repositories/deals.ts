import { prisma } from "../client.ts";

export interface PublishedDealRecord {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  merchant: string;
  currentPrice: string;
  affiliateUrl: string;
  publishedAt: string;
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

function mapPublishedDealRecord(row: {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  deal: {
    category: string;
    merchant: string;
    currentPrice: { toString(): string };
    affiliateUrl: string;
    updatedAt: Date;
    status: string;
  };
}): PublishedDealRecord | null {
  if (row.deal.status !== "published") {
    return null;
  }

  return {
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.deal.category,
    merchant: row.deal.merchant,
    currentPrice: row.deal.currentPrice.toString(),
    affiliateUrl: row.deal.affiliateUrl,
    publishedAt: row.deal.updatedAt.toISOString(),
  };
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
              category: true,
              merchant: true,
              currentPrice: true,
              affiliateUrl: true,
              updatedAt: true,
              status: true,
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
          category: true,
          merchant: true,
          currentPrice: true,
          affiliateUrl: true,
          updatedAt: true,
          status: true,
          locales: {
            where: {
              locale,
            },
            orderBy: {
              slug: "asc",
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
          deal.locales.flatMap((dealLocale) => {
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
