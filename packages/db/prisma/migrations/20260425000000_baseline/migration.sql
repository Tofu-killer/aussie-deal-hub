-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "fetchMethod" TEXT NOT NULL DEFAULT 'html',
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "language" TEXT NOT NULL DEFAULT 'en',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),
    "lastPollStatus" TEXT,
    "lastPollMessage" TEXT,
    "lastLeadCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "merchant" TEXT,
    "sourceScore" INTEGER,
    "sourceSnapshot" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "aiConfidence" INTEGER,
    "riskLabels" TEXT[],
    "localizedHints" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currentPrice" DECIMAL(65,30) NOT NULL,
    "originalPrice" DECIMAL(65,30),
    "discountPercent" INTEGER,
    "couponCode" TEXT,
    "affiliateUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealLocale" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,

    CONSTRAINT "DealLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadReviewDraft" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "riskLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featuredSlot" TEXT NOT NULL DEFAULT '',
    "publishAt" TEXT NOT NULL,
    "publish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadReviewDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadReviewDraftLocale" (
    "id" TEXT NOT NULL,
    "reviewDraftId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "LeadReviewDraftLocale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "normalizedEmail" TEXT NOT NULL,
    "dealSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("normalizedEmail","dealSlug")
);

-- CreateTable
CREATE TABLE "EmailDigestSubscription" (
    "normalizedEmail" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDigestSubscription_pkey" PRIMARY KEY ("normalizedEmail")
);

-- CreateTable
CREATE TABLE "MerchantCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activeDeals" INTEGER NOT NULL DEFAULT 0,
    "primaryCategory" TEXT NOT NULL DEFAULT 'Unassigned',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "owner" TEXT NOT NULL DEFAULT 'Admin catalog',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "visibleDeals" INTEGER NOT NULL DEFAULT 0,
    "localization" TEXT NOT NULL DEFAULT 'Needs localization',
    "owner" TEXT NOT NULL DEFAULT 'Admin catalog',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "spotlightDeals" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "owner" TEXT NOT NULL DEFAULT 'Admin topics',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "dealSlug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "merchant" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_baseUrl_key" ON "Source"("baseUrl");

-- CreateIndex
CREATE INDEX "Lead_sourceId_reviewStatus_idx" ON "Lead"("sourceId", "reviewStatus");

-- CreateIndex
CREATE INDEX "Lead_canonicalUrl_idx" ON "Lead"("canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_leadId_key" ON "Deal"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "DealLocale_slug_key" ON "DealLocale"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DealLocale_dealId_locale_key" ON "DealLocale"("dealId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "LeadReviewDraft_leadId_key" ON "LeadReviewDraft"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadReviewDraftLocale_reviewDraftId_locale_key" ON "LeadReviewDraftLocale"("reviewDraftId", "locale");

-- CreateIndex
CREATE INDEX "Favorite_normalizedEmail_idx" ON "Favorite"("normalizedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "TagCatalog_slug_key" ON "TagCatalog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TopicCatalog_slug_key" ON "TopicCatalog"("slug");

-- CreateIndex
CREATE INDEX "PriceSnapshot_dealSlug_observedAt_idx" ON "PriceSnapshot"("dealSlug", "observedAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealLocale" ADD CONSTRAINT "DealLocale_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadReviewDraft" ADD CONSTRAINT "LeadReviewDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadReviewDraftLocale" ADD CONSTRAINT "LeadReviewDraftLocale_reviewDraftId_fkey" FOREIGN KEY ("reviewDraftId") REFERENCES "LeadReviewDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
