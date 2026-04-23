import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { listSources, updateSourceEnabled } from "@aussie-deal-hub/db/repositories/sources";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describe("admin sources API contract", () => {
  it("returns 400 when required fields are missing in post payload", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async setEnabled() {
          return null;
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/sources",
      body: {
        name: "Source without trust score",
        baseUrl: "https://missing-fields.example.com",
        language: "en",
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Source payload is invalid.",
    });
  });

  it("returns 400 when enabled is missing in patch payload", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async setEnabled() {
          return null;
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/sources/source_1",
      body: {},
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Source payload is invalid.",
    });
  });

  it("returns 404 when patching a missing source", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async setEnabled() {
          return null;
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "PATCH",
      path: "/v1/admin/sources/missing-source",
      body: {
        enabled: false,
      },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Source not found.",
    });
  });
});

describeDb("admin sources persistence", () => {
  it("creates a source with deterministic defaults", async () => {
    const suffix = randomUUID();
    const payload = {
      name: `Created Source ${suffix}`,
      baseUrl: `https://created-source-${suffix}.example.com`,
      language: "en",
      trustScore: 64,
    };

    const app = buildApp();

    try {
      const response = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/sources",
        body: payload,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(String),
        ...payload,
        enabled: true,
      });

      const created = await prisma.source.findUnique({
        where: { baseUrl: payload.baseUrl },
        select: {
          name: true,
          sourceType: true,
          baseUrl: true,
          trustScore: true,
          language: true,
          enabled: true,
        },
      });

      expect(created).toEqual({
        name: payload.name,
        sourceType: "community",
        baseUrl: payload.baseUrl,
        trustScore: payload.trustScore,
        language: payload.language,
        enabled: true,
      });
    } finally {
      await prisma.source.deleteMany({
        where: {
          baseUrl: payload.baseUrl,
        },
      });
    }
  });

  it("lists sources and persists enabled state changes", async () => {
    const suffix = randomUUID();
    const seeded = [
      {
        name: `Source One ${suffix}`,
        sourceType: "community",
        baseUrl: `https://source-one-${suffix}.example.com`,
        trustScore: 72,
        language: "en",
        enabled: true,
      },
      {
        name: `Source Two ${suffix}`,
        sourceType: "retailer",
        baseUrl: `https://source-two-${suffix}.example.com`,
        trustScore: 67,
        language: "en",
        enabled: true,
      },
      {
        name: `Source Three ${suffix}`,
        sourceType: "forum",
        baseUrl: `https://source-three-${suffix}.example.com`,
        trustScore: 54,
        language: "zh",
        enabled: false,
      },
    ];

    await prisma.source.createMany({ data: seeded });
    const created = await prisma.source.findMany({
      where: { baseUrl: { in: seeded.map((source) => source.baseUrl) } },
      orderBy: { baseUrl: "asc" },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        trustScore: true,
        language: true,
        enabled: true,
      },
    });

    const app = buildApp({
      sourceStore: {
        list: listSources,
        setEnabled: updateSourceEnabled,
      },
    });

    try {
      const listResponse = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/admin/sources",
      });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({
        items: expect.arrayContaining(created),
      });

      const target = created[1];
      const patchResponse = await dispatchRequest(app, {
        method: "PATCH",
        path: `/v1/admin/sources/${target.id}`,
        body: { enabled: false },
      });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body).toEqual({
        ...target,
        enabled: false,
      });

      const persisted = await prisma.source.findUnique({
        where: { id: target.id },
        select: { enabled: true },
      });

      expect(persisted).toEqual({ enabled: false });
    } finally {
      await prisma.source.deleteMany({
        where: {
          baseUrl: {
            in: seeded.map((source) => source.baseUrl),
          },
        },
      });
    }
  });
});
