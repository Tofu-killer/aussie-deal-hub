import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

async function restoreTopicBaseline() {
  const { seedAdminCatalog } = await import("@aussie-deal-hub/db/repositories/catalog");

  await prisma.topicCatalog.deleteMany();
  await seedAdminCatalog();
}

describeDb("admin topics persistence", () => {
  it("exposes migration-seeded topic baselines on a migrated database", async () => {
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

    const listResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/topics",
    });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      items: [
        {
          id: "gaming-setup",
          name: "Gaming Setup",
          slug: "gaming-setup",
          spotlightDeals: 9,
          status: "Active",
          owner: "Discovery desk",
        },
        {
          id: "school-savings",
          name: "School Savings",
          slug: "school-savings",
          spotlightDeals: 4,
          status: "Seasonal",
          owner: "Everyday desk",
        },
        {
          id: "work-from-home",
          name: "Work From Home",
          slug: "work-from-home",
          spotlightDeals: 6,
          status: "Active",
          owner: "Discovery desk",
        },
      ],
    });
  });

  it("keeps topic lists empty until the explicit seed command runs", async () => {
    const { createAdminCatalogRepository, seedAdminCatalog } = await import(
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
      await prisma.topicCatalog.deleteMany();

      const topicsBeforeSeed = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/topics",
      });

      expect(topicsBeforeSeed.status).toBe(200);
      expect(topicsBeforeSeed.body).toEqual({
        items: [],
      });

      await seedAdminCatalog();

      const topicsAfterSeed = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/topics",
      });

      expect(topicsAfterSeed.status).toBe(200);
      expect(topicsAfterSeed.body).toEqual({
        items: [
          {
            id: "gaming-setup",
            name: "Gaming Setup",
            slug: "gaming-setup",
            spotlightDeals: 9,
            status: "Active",
            owner: "Discovery desk",
          },
          {
            id: "school-savings",
            name: "School Savings",
            slug: "school-savings",
            spotlightDeals: 4,
            status: "Seasonal",
            owner: "Everyday desk",
          },
          {
            id: "work-from-home",
            name: "Work From Home",
            slug: "work-from-home",
            spotlightDeals: 6,
            status: "Active",
            owner: "Discovery desk",
          },
        ],
      });
    } finally {
      await restoreTopicBaseline();
    }
  });

  it("backfills missing baseline topic rows when explicit seed runs on a partially populated table", async () => {
    const { seedAdminCatalog } = await import("@aussie-deal-hub/db/repositories/catalog");

    try {
      await prisma.topicCatalog.deleteMany();

      await prisma.topicCatalog.create({
        data: {
          id: "custom-topic",
          name: "Custom Topic",
          slug: "custom-topic",
        },
      });

      await seedAdminCatalog();

      expect(
        (
          await prisma.topicCatalog.findMany({
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
            },
          })
        ).map((row) => row.id),
      ).toEqual(["custom-topic", "gaming-setup", "school-savings", "work-from-home"]);
    } finally {
      await restoreTopicBaseline();
    }
  });

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
      await prisma.topicCatalog.deleteMany();

      const listBeforeCreate = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/topics",
      });

      expect(listBeforeCreate.status).toBe(200);
      expect(listBeforeCreate.body).toEqual({
        items: [],
      });

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

      const listResponse = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/topics",
      });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({
        items: [
          {
            id: topicId,
            name: topicName,
            slug: topicId,
            spotlightDeals: 0,
            status: "Draft",
            owner: "Admin topics",
          },
        ],
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
      await restoreTopicBaseline();
    }
  });
});
