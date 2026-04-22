import express from "express";

import { createAdminLeadsRouter, type LeadRecord } from "./routes/adminLeads.ts";
import { createAuthRouter, type SessionRecord } from "./routes/auth.ts";
import {
  createDigestPreferencesRouter,
  type DigestPreferencesRecord,
  type DigestPreferencesStore,
} from "./routes/digestPreferences.ts";
import { createFavoritesRouter, type FavoritesStore } from "./routes/favorites.ts";
import { createHealthRouter } from "./routes/health.ts";
import {
  createPublicDealsRouter,
  getPublishedDealIds,
  type PriceSnapshotStore,
  seedPublishedDeals,
} from "./routes/publicDeals.ts";

interface BuildAppOptions {
  digestPreferencesStore?: DigestPreferencesStore;
  favoritesStore?: FavoritesStore;
  priceSnapshotStore?: PriceSnapshotStore;
}

export function buildApp(options: BuildAppOptions = {}) {
  const leads = new Map<string, LeadRecord>();
  const codes = new Map<string, string>();
  const sessions = new Map<string, SessionRecord>();
  const publishedDeals = seedPublishedDeals();
  const publishedDealIds = getPublishedDealIds(publishedDeals);
  const digestPreferences = new Map<string, DigestPreferencesRecord>();
  const app = express();

  app.use(express.json());
  app.use("/health", createHealthRouter());
  app.use("/v1/health", createHealthRouter());
  app.use("/v1/auth", createAuthRouter(codes, sessions));
  app.use("/v1/admin", createAdminLeadsRouter(leads));
  app.use(
    "/v1/digest-preferences",
    createDigestPreferencesRouter(
      sessions,
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
    createFavoritesRouter(sessions, publishedDealIds, options.favoritesStore),
  );
  app.use("/v1/public", createPublicDealsRouter(publishedDeals, options.priceSnapshotStore));

  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found." });
  });

  return app;
}
