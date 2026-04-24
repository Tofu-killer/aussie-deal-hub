import express, { type NextFunction, type Request, type Response } from "express";

import { createAdminCatalogRouter } from "./routes/adminCatalog.ts";
import {
  createLead,
  createAdminLeadsRouter,
  saveLeadReviewDraft,
  type AdminLeadStore,
  type LeadRecord,
  type LeadReviewStore,
} from "./routes/adminLeads.ts";
import {
  createAdminPublishingRouter,
} from "./routes/adminPublishing.ts";
import { createAdminPreviewRouter } from "./routes/adminPreview.ts";
import { createAdminSourcesRouter, type SourcesStore } from "./routes/adminSources.ts";
import {
  createAuthRouter,
  createSignedSessionManager,
  type SessionManager,
} from "./routes/auth.ts";
import {
  createDigestPreferencesRouter,
  type DigestPreferencesRecord,
  type DigestPreferencesStore,
} from "./routes/digestPreferences.ts";
import { createFavoritesRouter, type FavoritesStore } from "./routes/favorites.ts";
import { createHealthRouter, type HealthChecker } from "./routes/health.ts";
import {
  createSeedPublishedDealStore,
  createPublicDealsRouter,
  type PublishedDealListReader,
  type PublishedDealReader,
  type PublishedDealPublisher,
  type PublishedDealSlugLookup,
  type PriceSnapshotStore,
  seedPublishedDeals,
} from "./routes/publicDeals.ts";

interface BuildAppOptions {
  adminLeadStore?: AdminLeadStore;
  digestPreferencesStore?: DigestPreferencesStore;
  favoritesStore?: FavoritesStore;
  healthCheck?: HealthChecker;
  readyCheck?: HealthChecker;
  sessionManager?: SessionManager;
  publishedDealStore?: PublishedDealReader &
    Partial<PublishedDealListReader> &
    Partial<PublishedDealPublisher> &
    Partial<PublishedDealSlugLookup>;
  priceSnapshotStore?: PriceSnapshotStore;
  sourceStore?: SourcesStore;
}

export function buildApp(options: BuildAppOptions = {}) {
  const leads = new Map<string, LeadRecord>();
  const leadReviews: LeadReviewStore = new Map();
  const codes = new Map<string, string>();
  const sessionManager =
    options.sessionManager ??
    createSignedSessionManager(process.env.SESSION_SECRET ?? "development-session-secret");
  const publishedDeals = seedPublishedDeals();
  const publishedDealStore = options.publishedDealStore ?? createSeedPublishedDealStore(publishedDeals);
  const previewPublishedDealStore = options.publishedDealStore?.listPublishedDeals
    ? {
        listPublishedDeals: options.publishedDealStore.listPublishedDeals,
      }
    : undefined;
  const digestPreferences = new Map<string, DigestPreferencesRecord>();
  const app = express();
  const adminLeadStore =
    options.adminLeadStore ??
    ({
      async listLeadRecords() {
        return Array.from(leads.values()).map((lead) => ({
          lead,
          review: leadReviews.get(lead.id) ?? null,
        }));
      },
      async getLeadRecord(leadId) {
        const lead = leads.get(leadId);

        if (!lead) {
          return null;
        }

        return {
          lead,
          review: leadReviews.get(leadId) ?? null,
        };
      },
      async createLead(input) {
        return createLead(leads, input);
      },
      async saveLeadReviewDraft(input) {
        if (!leads.has(input.leadId)) {
          return null;
        }

        return saveLeadReviewDraft(leadReviews, input);
      },
    } satisfies AdminLeadStore);

  app.use(express.json());
  app.use("/health", createHealthRouter(options.healthCheck));
  app.use("/v1/health", createHealthRouter(options.healthCheck));
  app.use("/ready", createHealthRouter(options.readyCheck ?? options.healthCheck));
  app.use("/v1/ready", createHealthRouter(options.readyCheck ?? options.healthCheck));
  app.use("/v1/auth", createAuthRouter(codes, sessionManager));
  app.use("/v1/admin", createAdminLeadsRouter(adminLeadStore, publishedDealStore));
  app.use("/v1/admin", createAdminCatalogRouter());
  app.use(
    "/v1/admin/publishing",
    createAdminPublishingRouter(adminLeadStore, publishedDealStore),
  );
  app.use("/v1/admin", createAdminPreviewRouter(previewPublishedDealStore));
  app.use("/v1/admin/sources", createAdminSourcesRouter(options.sourceStore));
  app.use(
    "/v1/digest-preferences",
    createDigestPreferencesRouter(
      sessionManager,
      options.digestPreferencesStore ?? {
        async getByEmail(email) {
          return digestPreferences.get(email.trim().toLowerCase()) ?? null;
        },
        async upsertByEmail(email, input) {
          const normalizedEmail = email.trim().toLowerCase();
          digestPreferences.set(normalizedEmail, input);
          return digestPreferences.get(normalizedEmail)!;
        },
      },
    ),
  );
  app.use(
    "/v1/favorites",
    createFavoritesRouter(sessionManager, publishedDealStore, options.favoritesStore),
  );
  app.use("/v1/public", createPublicDealsRouter(publishedDealStore, options.priceSnapshotStore));

  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found." });
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const isDependencyError =
      error instanceof Error && error.name === "PrismaClientInitializationError";

    response.status(isDependencyError ? 503 : 500).json({
      message: isDependencyError ? "Dependency unavailable." : "Internal server error.",
    });
  });

  return app;
}
