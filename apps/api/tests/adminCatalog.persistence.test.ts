import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("admin catalog persistence", () => {
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
      await prisma.merchantCatalog.deleteMany({
        where: {
          id: merchantId,
        },
      });
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
      await prisma.tagCatalog.deleteMany({
        where: {
          id: tagId,
        },
      });
    }
  });
});
