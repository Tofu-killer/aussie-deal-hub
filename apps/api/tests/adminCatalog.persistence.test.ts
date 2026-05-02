import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

async function clearCatalogTables() {
  await prisma.topicCatalog.deleteMany();
  await prisma.tagCatalog.deleteMany();
  await prisma.merchantCatalog.deleteMany();
}

async function restoreCatalogBaseline() {
  const { seedAdminCatalog } = await import("@aussie-deal-hub/db/repositories/catalog");

  await clearCatalogTables();
  await seedAdminCatalog();
}

describeDb("admin catalog persistence", () => {
  it("exposes migration-seeded merchant and tag baselines on a migrated database", async () => {
    const { createAdminCatalogRepository } = await import("@aussie-deal-hub/db/repositories/catalog");
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    const merchantsResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/merchants",
    });

    expect(merchantsResponse.status).toBe(200);
    expect(merchantsResponse.body).toEqual({
      items: [
        {
          id: "amazon-au",
          name: "Amazon AU",
          activeDeals: 42,
          primaryCategory: "Electronics",
          status: "Active",
          owner: "Marketplace desk",
        },
        {
          id: "chemist-warehouse",
          name: "Chemist Warehouse",
          activeDeals: 17,
          primaryCategory: "Health",
          status: "Needs review",
          owner: "Retail desk",
        },
        {
          id: "the-iconic",
          name: "The Iconic",
          activeDeals: 9,
          primaryCategory: "Fashion",
          status: "Active",
          owner: "Lifestyle desk",
        },
      ],
    });

    const tagsResponse = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/admin/tags",
    });

    expect(tagsResponse.status).toBe(200);
    expect(tagsResponse.body).toEqual({
      items: [
        {
          id: "gaming",
          name: "Gaming",
          slug: "gaming",
          visibleDeals: 18,
          localization: "EN + ZH ready",
          owner: "Discovery desk",
        },
        {
          id: "grocery",
          name: "Grocery",
          slug: "grocery",
          visibleDeals: 25,
          localization: "EN + ZH ready",
          owner: "Everyday desk",
        },
        {
          id: "travel",
          name: "Travel",
          slug: "travel",
          visibleDeals: 7,
          localization: "Needs ZH review",
          owner: "Lifestyle desk",
        },
      ],
    });
  });

  it("keeps catalog lists empty until the explicit seed command runs", async () => {
    const { createAdminCatalogRepository, seedAdminCatalog } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await clearCatalogTables();

      const merchantsBeforeSeed = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/merchants",
      });

      expect(merchantsBeforeSeed.status).toBe(200);
      expect(merchantsBeforeSeed.body).toEqual({
        items: [],
      });

      const tagsBeforeSeed = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/tags",
      });

      expect(tagsBeforeSeed.status).toBe(200);
      expect(tagsBeforeSeed.body).toEqual({
        items: [],
      });

      await seedAdminCatalog();

      const merchantsAfterSeed = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/merchants",
      });

      expect(merchantsAfterSeed.status).toBe(200);
      expect(merchantsAfterSeed.body).toEqual({
        items: [
          {
            id: "amazon-au",
            name: "Amazon AU",
            activeDeals: 42,
            primaryCategory: "Electronics",
            status: "Active",
            owner: "Marketplace desk",
          },
          {
            id: "chemist-warehouse",
            name: "Chemist Warehouse",
            activeDeals: 17,
            primaryCategory: "Health",
            status: "Needs review",
            owner: "Retail desk",
          },
          {
            id: "the-iconic",
            name: "The Iconic",
            activeDeals: 9,
            primaryCategory: "Fashion",
            status: "Active",
            owner: "Lifestyle desk",
          },
        ],
      });

      const tagsAfterSeed = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/tags",
      });

      expect(tagsAfterSeed.status).toBe(200);
      expect(tagsAfterSeed.body).toEqual({
        items: [
          {
            id: "gaming",
            name: "Gaming",
            slug: "gaming",
            visibleDeals: 18,
            localization: "EN + ZH ready",
            owner: "Discovery desk",
          },
          {
            id: "grocery",
            name: "Grocery",
            slug: "grocery",
            visibleDeals: 25,
            localization: "EN + ZH ready",
            owner: "Everyday desk",
          },
          {
            id: "travel",
            name: "Travel",
            slug: "travel",
            visibleDeals: 7,
            localization: "Needs ZH review",
            owner: "Lifestyle desk",
          },
        ],
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("backfills missing baseline catalog rows when explicit seed runs on partially populated tables", async () => {
    const { seedAdminCatalog } = await import("@aussie-deal-hub/db/repositories/catalog");

    try {
      await clearCatalogTables();

      await prisma.merchantCatalog.create({
        data: {
          id: "custom-merchant",
          name: "Custom Merchant",
        },
      });
      await prisma.tagCatalog.create({
        data: {
          id: "custom-tag",
          name: "Custom Tag",
          slug: "custom-tag",
        },
      });
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
          await prisma.merchantCatalog.findMany({
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
            },
          })
        ).map((row) => row.id),
      ).toEqual(["amazon-au", "chemist-warehouse", "custom-merchant", "the-iconic"]);

      expect(
        (
          await prisma.tagCatalog.findMany({
            orderBy: {
              id: "asc",
            },
            select: {
              id: true,
            },
          })
        ).map((row) => row.id),
      ).toEqual(["custom-tag", "gaming", "grocery", "travel"]);

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
      await restoreCatalogBaseline();
    }
  });

  it("creates a merchant row and persists it to the database-backed catalog store", async () => {
    const suffix = randomUUID();
    const merchantName = `JB Hi-Fi ${suffix}`;
    const merchantId = `jb-hi-fi-${suffix.toLowerCase()}`;
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await clearCatalogTables();

      const createResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/merchants",
        body: {
          name: merchantName,
        },
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toEqual({
        id: merchantId,
        name: merchantName,
        activeDeals: 0,
        primaryCategory: "Unassigned",
        status: "Draft",
        owner: "Admin catalog",
      });

      const listResponse = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/merchants",
      });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({
        items: [
          {
            id: merchantId,
            name: merchantName,
            activeDeals: 0,
            primaryCategory: "Unassigned",
            status: "Draft",
            owner: "Admin catalog",
          },
        ],
      });

      const persisted = await prisma.merchantCatalog.findUnique({
        where: {
          id: merchantId,
        },
        select: {
          id: true,
          name: true,
          activeDeals: true,
          primaryCategory: true,
          status: true,
          owner: true,
        },
      });

      expect(persisted).toEqual({
        id: merchantId,
        name: merchantName,
        activeDeals: 0,
        primaryCategory: "Unassigned",
        status: "Draft",
        owner: "Admin catalog",
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("creates a tag row and persists it to the database-backed catalog store", async () => {
    const suffix = randomUUID();
    const tagName = `Home Office ${suffix}`;
    const tagId = `home-office-${suffix.toLowerCase()}`;
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await clearCatalogTables();

      const createResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/tags",
        body: {
          name: tagName,
        },
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toEqual({
        id: tagId,
        name: tagName,
        slug: tagId,
        visibleDeals: 0,
        localization: "Needs localization",
        owner: "Admin catalog",
      });

      const listResponse = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/tags",
      });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({
        items: [
          {
            id: tagId,
            name: tagName,
            slug: tagId,
            visibleDeals: 0,
            localization: "Needs localization",
            owner: "Admin catalog",
          },
        ],
      });

      const persisted = await prisma.tagCatalog.findUnique({
        where: {
          id: tagId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          visibleDeals: true,
          localization: true,
          owner: true,
        },
      });

      expect(persisted).toEqual({
        id: tagId,
        name: tagName,
        slug: tagId,
        visibleDeals: 0,
        localization: "Needs localization",
        owner: "Admin catalog",
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("creates a tag row with a unique slug when an existing tag already uses the base slug", async () => {
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await restoreCatalogBaseline();

      const updateResponse = await dispatchRequest(app, {
        method: "PATCH",
        path: "/v1/admin/tags/travel",
        body: {
          slug: "home-office",
        },
      });
      const createResponse = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/tags",
        body: {
          name: "Home Office",
        },
      });

      expect(updateResponse.status).toBe(200);
      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toEqual({
        id: "home-office-2",
        name: "Home Office",
        slug: "home-office-2",
        visibleDeals: 0,
        localization: "Needs localization",
        owner: "Admin catalog",
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("updates a merchant row and persists the edited catalog fields", async () => {
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await restoreCatalogBaseline();

      const updateResponse = await dispatchRequest(app, {
        method: "PATCH",
        path: "/v1/admin/merchants/amazon-au",
        body: {
          name: "Amazon Australia",
          primaryCategory: "Marketplace",
          status: "Paused",
          owner: "Commerce desk",
        },
      });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toEqual({
        id: "amazon-au",
        name: "Amazon Australia",
        activeDeals: 42,
        primaryCategory: "Marketplace",
        status: "Paused",
        owner: "Commerce desk",
      });

      const persisted = await prisma.merchantCatalog.findUnique({
        where: {
          id: "amazon-au",
        },
        select: {
          id: true,
          name: true,
          activeDeals: true,
          primaryCategory: true,
          status: true,
          owner: true,
        },
      });

      expect(persisted).toEqual({
        id: "amazon-au",
        name: "Amazon Australia",
        activeDeals: 42,
        primaryCategory: "Marketplace",
        status: "Paused",
        owner: "Commerce desk",
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("updates a tag row and persists the edited catalog fields", async () => {
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await restoreCatalogBaseline();

      const updateResponse = await dispatchRequest(app, {
        method: "PATCH",
        path: "/v1/admin/tags/travel",
        body: {
          name: "Travel Deals",
          slug: "travel-deals",
          localization: "EN only",
          owner: "Merch desk",
        },
      });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toEqual({
        id: "travel",
        name: "Travel Deals",
        slug: "travel-deals",
        visibleDeals: 7,
        localization: "EN only",
        owner: "Merch desk",
      });

      const persisted = await prisma.tagCatalog.findUnique({
        where: {
          id: "travel",
        },
        select: {
          id: true,
          name: true,
          slug: true,
          visibleDeals: true,
          localization: true,
          owner: true,
        },
      });

      expect(persisted).toEqual({
        id: "travel",
        name: "Travel Deals",
        slug: "travel-deals",
        visibleDeals: 7,
        localization: "EN only",
        owner: "Merch desk",
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("deletes a merchant row and persists its removal from the catalog store", async () => {
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await restoreCatalogBaseline();

      const deleteResponse = await dispatchRequest(app, {
        method: "DELETE",
        path: "/v1/admin/merchants/amazon-au",
      });

      expect(deleteResponse.status).toBe(204);
      expect(deleteResponse.body).toBeUndefined();

      const persisted = await prisma.merchantCatalog.findUnique({
        where: {
          id: "amazon-au",
        },
      });

      expect(persisted).toBeNull();

      const listResponse = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/merchants",
      });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({
        items: [
          {
            id: "chemist-warehouse",
            name: "Chemist Warehouse",
            activeDeals: 17,
            primaryCategory: "Health",
            status: "Needs review",
            owner: "Retail desk",
          },
          {
            id: "the-iconic",
            name: "The Iconic",
            activeDeals: 9,
            primaryCategory: "Fashion",
            status: "Active",
            owner: "Lifestyle desk",
          },
        ],
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("deletes a tag row and persists its removal from the catalog store", async () => {
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await restoreCatalogBaseline();

      const deleteResponse = await dispatchRequest(app, {
        method: "DELETE",
        path: "/v1/admin/tags/travel",
      });

      expect(deleteResponse.status).toBe(204);
      expect(deleteResponse.body).toBeUndefined();

      const persisted = await prisma.tagCatalog.findUnique({
        where: {
          id: "travel",
        },
      });

      expect(persisted).toBeNull();

      const listResponse = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/tags",
      });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({
        items: [
          {
            id: "gaming",
            name: "Gaming",
            slug: "gaming",
            visibleDeals: 18,
            localization: "EN + ZH ready",
            owner: "Discovery desk",
          },
          {
            id: "grocery",
            name: "Grocery",
            slug: "grocery",
            visibleDeals: 25,
            localization: "EN + ZH ready",
            owner: "Everyday desk",
          },
        ],
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });

  it("rejects duplicate tag slugs against the database-backed catalog store", async () => {
    const { createAdminCatalogRepository } = await import(
      "@aussie-deal-hub/db/repositories/catalog"
    );
    const app = buildApp({
      adminCatalogStore: createAdminCatalogRepository(),
    } as never);

    try {
      await restoreCatalogBaseline();

      const response = await dispatchRequest(app, {
        method: "PATCH",
        path: "/v1/admin/tags/travel",
        body: {
          slug: "grocery",
        },
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        message: "Slug already exists.",
      });
    } finally {
      await restoreCatalogBaseline();
    }
  });
});
