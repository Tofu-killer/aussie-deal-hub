import express from "express";

import { createAdminLeadsRouter, type LeadRecord } from "./routes/adminLeads.ts";
import { createAuthRouter, type SessionRecord } from "./routes/auth.ts";
import { createFavoritesRouter, type FavoritesStore } from "./routes/favorites.ts";
import { createHealthRouter } from "./routes/health.ts";
import {
  createPublicDealsRouter,
  getPublishedDealIds,
  type PriceSnapshotStore,
  seedPublishedDeals,
} from "./routes/publicDeals.ts";

interface BuildAppOptions {
  favoritesStore?: FavoritesStore;
  priceSnapshotStore?: PriceSnapshotStore;
}

export function buildApp(options: BuildAppOptions = {}) {
  const leads = new Map<string, LeadRecord>();
  const codes = new Map<string, string>();
  const sessions = new Map<string, SessionRecord>();
  const publishedDeals = seedPublishedDeals();
  const publishedDealIds = getPublishedDealIds(publishedDeals);
  const app = express();

  app.use(express.json());
  app.use("/health", createHealthRouter());
  app.use("/v1/health", createHealthRouter());
  app.use("/v1/auth", createAuthRouter(codes, sessions));
  app.use("/v1/admin", createAdminLeadsRouter(leads));
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
