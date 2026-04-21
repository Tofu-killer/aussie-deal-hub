import express from "express";

import { createAdminLeadsRouter, type LeadRecord } from "./routes/adminLeads.ts";
import { createHealthRouter } from "./routes/health.ts";
import { createPublicDealsRouter, seedPublishedDeals } from "./routes/publicDeals.ts";

export function buildApp() {
  const leads = new Map<string, LeadRecord>();
  const publishedDeals = seedPublishedDeals();
  const app = express();

  app.use(express.json());
  app.use("/health", createHealthRouter());
  app.use("/v1/health", createHealthRouter());
  app.use("/v1/admin", createAdminLeadsRouter(leads));
  app.use("/v1/public", createPublicDealsRouter(publishedDeals));

  app.use((_request, response) => {
    response.status(404).json({ message: "Route not found." });
  });

  return app;
}
