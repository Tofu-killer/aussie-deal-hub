import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("admin topics persistence", () => {
  it("creates a topic row and persists it", async () => {
    const suffix = randomUUID();
    const topicName = `EOFY Tech ${suffix}`;
    const topicId = `eofy-tech-${suffix.toLowerCase()}`;
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const adminCatalogStore = createAdminCatalogRepository();
    const app = buildApp({
      adminTopicsStore: {
        listTopics: adminCatalogStore.listTopics,
        createTopic: adminCatalogStore.createTopic,
      },
    } as never);

    try {
      const createResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/topics",
        body: {
          name: topicName,
        },
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toEqual({
        id: topicId,
        name: topicName,
        slug: topicId,
        spotlightDeals: 0,
        status: "Draft",
        owner: "Admin topics",
      });

      const persisted = await prisma.topicCatalog.findUnique({
        where: {
          id: topicId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          spotlightDeals: true,
          status: true,
          owner: true,
        },
      });

      expect(persisted).toEqual({
        id: topicId,
        name: topicName,
        slug: topicId,
        spotlightDeals: 0,
        status: "Draft",
        owner: "Admin topics",
      });
    } finally {
      await prisma.topicCatalog.deleteMany({
        where: {
          id: topicId,
        },
      });
    }
  });
});
