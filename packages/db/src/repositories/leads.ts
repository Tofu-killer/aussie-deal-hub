import { randomUUID } from "node:crypto";

import { prisma } from "../client.ts";

interface LeadRecord {
  id: string;
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  createdAt: string;
}

interface LeadReviewLocaleDraft {
  title: string;
  summary: string;
}

interface LeadReviewDraftSubmission {
  leadId: string;
  category: string;
  confidence: number;
  riskLabels: string[];
  tags: string[];
  featuredSlot: string;
  publishAt: string;
  locales: {
    en: LeadReviewLocaleDraft;
    zh: LeadReviewLocaleDraft;
  };
  publish: boolean;
}

interface StoredLeadReviewDraft extends LeadReviewDraftSubmission {
  updatedAt: string;
}

interface StoredLeadRecord {
  lead: LeadRecord;
  review: StoredLeadReviewDraft | null;
}

interface LeadRecordRow {
  id: string;
  sourceId: string;
  originalTitle: string;
  originalUrl: string;
  snippet: string;
  createdAt: Date;
}

interface LeadReviewDraftLocaleRow {
  locale: string;
  title: string;
  summary: string;
}

interface LeadReviewDraftRow {
  id: string;
  leadId: string;
  category: string;
  confidence: number;
  riskLabels: string[];
  tags: string[];
  featuredSlot: string;
  publishAt: string;
  publish: boolean;
  updatedAt: Date;
  locales: LeadReviewDraftLocaleRow[];
}

interface LeadWithReviewRow extends LeadRecordRow {
  reviewDraft: LeadReviewDraftRow | null;
}

function createLeadId() {
  return `lead_${randomUUID()}`;
}

function createPlaceholderSourceUrl(sourceId: string) {
  return `https://admin-source.local/${encodeURIComponent(sourceId)}`;
}

function mapLeadRecord(row: LeadRecordRow): LeadRecord {
  return {
    id: row.id,
    sourceId: row.sourceId,
    originalTitle: row.originalTitle,
    originalUrl: row.originalUrl,
    snippet: row.snippet,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapLeadReviewDraft(row: LeadReviewDraftRow): StoredLeadReviewDraft {
  const locales = new Map(
    row.locales.map((locale) => [
      locale.locale,
      {
        title: locale.title,
        summary: locale.summary,
      },
    ]),
  );

  return {
    leadId: row.leadId,
    category: row.category,
    confidence: row.confidence,
    riskLabels: row.riskLabels,
    tags: row.tags,
    featuredSlot: row.featuredSlot,
    publishAt: row.publishAt,
    locales: {
      en: locales.get("en") ?? {
        title: "",
        summary: "",
      },
      zh: locales.get("zh") ?? {
        title: "",
        summary: "",
      },
    },
    publish: row.publish,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapStoredLeadRecord(row: LeadWithReviewRow): StoredLeadRecord {
  return {
    lead: mapLeadRecord(row),
    review: row.reviewDraft ? mapLeadReviewDraft(row.reviewDraft) : null,
  };
}

async function ensureSourceExists(sourceId: string) {
  await prisma.source.upsert({
    where: {
      id: sourceId,
    },
    update: {},
    create: {
      id: sourceId,
      name: sourceId,
      sourceType: "admin",
      baseUrl: createPlaceholderSourceUrl(sourceId),
      trustScore: 50,
      language: "en",
      enabled: true,
    },
  });
}

const leadRecordSelect = {
  id: true,
  sourceId: true,
  originalTitle: true,
  originalUrl: true,
  snippet: true,
  createdAt: true,
} as const;

const leadReviewDraftSelect = {
  id: true,
  leadId: true,
  category: true,
  confidence: true,
  riskLabels: true,
  tags: true,
  featuredSlot: true,
  publishAt: true,
  publish: true,
  updatedAt: true,
  locales: {
    orderBy: {
      locale: "asc",
    },
    select: {
      locale: true,
      title: true,
      summary: true,
    },
  },
} as const;

const leadWithReviewSelect = {
  ...leadRecordSelect,
  reviewDraft: {
    select: leadReviewDraftSelect,
  },
} as const;

export function createAdminLeadRepository() {
  return {
    async listLeadRecords(): Promise<StoredLeadRecord[]> {
      const rows = await prisma.lead.findMany({
        orderBy: [
          {
            createdAt: "asc",
          },
          {
            id: "asc",
          },
        ],
        select: leadWithReviewSelect,
      });

      return rows.map((row) => mapStoredLeadRecord(row as LeadWithReviewRow));
    },

    async getLeadRecord(leadId: string): Promise<StoredLeadRecord | null> {
      const row = await prisma.lead.findUnique({
        where: {
          id: leadId,
        },
        select: leadWithReviewSelect,
      });

      return row ? mapStoredLeadRecord(row as LeadWithReviewRow) : null;
    },

    async createLead(input: {
      sourceId: string;
      originalTitle: string;
      originalUrl: string;
      snippet: string;
    }): Promise<LeadRecord> {
      await ensureSourceExists(input.sourceId);

      const row = await prisma.lead.create({
        data: {
          id: createLeadId(),
          sourceId: input.sourceId,
          originalTitle: input.originalTitle,
          originalUrl: input.originalUrl,
          canonicalUrl: input.originalUrl,
          snippet: input.snippet,
          riskLabels: [],
          localizedHints: [],
        },
        select: leadRecordSelect,
      });

      return mapLeadRecord(row as LeadRecordRow);
    },

    async saveLeadReviewDraft(
      input: LeadReviewDraftSubmission,
    ): Promise<StoredLeadReviewDraft | null> {
      return prisma.$transaction(async (transaction) => {
        const lead = await transaction.lead.findUnique({
          where: {
            id: input.leadId,
          },
          select: {
            id: true,
          },
        });

        if (!lead) {
          return null;
        }

        const reviewDraft = await transaction.leadReviewDraft.upsert({
          where: {
            leadId: input.leadId,
          },
          create: {
            leadId: input.leadId,
            category: input.category,
            confidence: input.confidence,
            riskLabels: input.riskLabels,
            tags: input.tags,
            featuredSlot: input.featuredSlot,
            publishAt: input.publishAt,
            publish: input.publish,
          },
          update: {
            category: input.category,
            confidence: input.confidence,
            riskLabels: input.riskLabels,
            tags: input.tags,
            featuredSlot: input.featuredSlot,
            publishAt: input.publishAt,
            publish: input.publish,
          },
          select: {
            id: true,
            updatedAt: true,
          },
        });

        await transaction.lead.update({
          where: {
            id: input.leadId,
          },
          data: {
            reviewStatus: "reviewed",
            aiConfidence: input.confidence,
            riskLabels: input.riskLabels,
            localizedHints: ["en", "zh"],
          },
        });

        await transaction.leadReviewDraftLocale.deleteMany({
          where: {
            reviewDraftId: reviewDraft.id,
          },
        });

        await transaction.leadReviewDraftLocale.createMany({
          data: [
            {
              reviewDraftId: reviewDraft.id,
              locale: "en",
              title: input.locales.en.title,
              summary: input.locales.en.summary,
            },
            {
              reviewDraftId: reviewDraft.id,
              locale: "zh",
              title: input.locales.zh.title,
              summary: input.locales.zh.summary,
            },
          ],
        });

        return {
          ...input,
          updatedAt: reviewDraft.updatedAt.toISOString(),
        };
      });
    },
  };
}
