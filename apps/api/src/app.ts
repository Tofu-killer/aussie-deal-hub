import express from "express";

import { createAdminLeadsRouter, type LeadRecord } from "./routes/adminLeads.ts";
import { createAuthRouter, type SessionRecord } from "./routes/auth.ts";
import { createFavoritesRouter } from "./routes/favorites.ts";
import { createHealthRouter } from "./routes/health.ts";
import { createPublicDealsRouter, getPublishedDealIds, seedPublishedDeals } from "./routes/publicDeals.ts";

export function buildApp() {
  const leads = new Map<string, LeadRecord>();
  const codes = new Map<string, string>();
  const sessions = new Map<string, SessionRecord>();
  const favorites = new Map<string, string[]>();
  const publishedDeals = seedPublishedDeals();
  const publishedDealIds = getPublishedDealIds(publishedDeals);
  const app = express();

  app.use(express.json());
  app.use("/health", createHealthRouter());
  app.use("/v1/health", createHealthRouter());
  app.use("/v1/auth", createAuthRouter(codes, sessions));
  app.use("/v1/admin", createAdminLeadsRouter(leads));
  app.use("/v1/favorites", createFavoritesRouter(sessions, favorites, publishedDealIds));
  app.use("/v1/public", createPublicDealsRouter(publishedDeals));

  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found." });
  });

  return app;
}
