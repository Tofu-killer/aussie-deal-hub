import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import { listSources, updateSource } from "@aussie-deal-hub/db/repositories/sources";
import { buildApp } from "../src/app";
import { dispatchRequest } from "./httpHarness";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("admin sources API contract", () => {
  it("returns 400 when scheduling fields are missing in post payload", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async update() {
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
        trustScore: 52,
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "Source payload is invalid.",
    });
  });

  it("returns 400 when patch payload omits supported fields", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async update() {
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
        async update() {
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

  it("polls a source immediately and returns the poll result", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async update() {
          return null;
        },
        async pollNow(sourceId) {
          expect(sourceId).toBe("source_1");

          return {
            createdLeadCount: 2,
            status: "ok",
            message: "Fetched 2 candidates; created 2 leads.",
            source: {
              id: "source_1",
              name: "Amazon AU",
              sourceType: "community",
              baseUrl: "https://www.amazon.com.au",
              fetchMethod: "html",
              pollIntervalMinutes: 60,
              trustScore: 91,
              language: "en-AU",
              enabled: false,
              pollCount: 4,
              lastPolledAt: "2026-04-25T02:03:04.000Z",
              lastPollStatus: "ok",
              lastPollMessage: "Fetched 2 candidates; created 2 leads.",
              lastLeadCreatedAt: "2026-04-25T02:03:04.000Z",
            },
          };
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/sources/source_1/poll",
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      createdLeadCount: 2,
      status: "ok",
      message: "Fetched 2 candidates; created 2 leads.",
      source: {
        id: "source_1",
        name: "Amazon AU",
        sourceType: "community",
        baseUrl: "https://www.amazon.com.au",
        fetchMethod: "html",
        pollIntervalMinutes: 60,
        trustScore: 91,
        language: "en-AU",
        enabled: false,
        pollCount: 4,
        lastPolledAt: "2026-04-25T02:03:04.000Z",
        lastPollStatus: "ok",
        lastPollMessage: "Fetched 2 candidates; created 2 leads.",
        lastLeadCreatedAt: "2026-04-25T02:03:04.000Z",
      },
    });
  });

  it("returns 404 when polling a missing source", async () => {
    const app = buildApp({
      sourceStore: {
        async list() {
          return [];
        },
        async update() {
          return null;
        },
        async pollNow() {
          return null;
        },
      },
    });

    const response = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/admin/sources/missing-source/poll",
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
      fetchMethod: "html",
      pollIntervalMinutes: 90,
    };

    const app = buildApp();

    try {
      const response = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/admin/sources",
        body: payload,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        ...payload,
        sourceType: "community",
        enabled: true,
        fetchMethod: "html",
        pollIntervalMinutes: 90,
        pollCount: 0,
        lastPolledAt: null,
        lastPollStatus: null,
        lastPollMessage: null,
        lastLeadCreatedAt: null,
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
          fetchMethod: true,
          pollIntervalMinutes: true,
          pollCount: true,
          lastPolledAt: true,
          lastPollStatus: true,
          lastPollMessage: true,
          lastLeadCreatedAt: true,
        },
      });

      expect(created).toMatchObject({
        name: payload.name,
        sourceType: "community",
        baseUrl: payload.baseUrl,
        trustScore: payload.trustScore,
        language: payload.language,
        enabled: true,
        fetchMethod: payload.fetchMethod,
        pollIntervalMinutes: payload.pollIntervalMinutes,
        pollCount: 0,
        lastPolledAt: null,
        lastPollStatus: null,
        lastPollMessage: null,
        lastLeadCreatedAt: null,
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
        fetchMethod: "html",
        pollIntervalMinutes: 60,
      },
      {
        name: `Source Two ${suffix}`,
        sourceType: "retailer",
        baseUrl: `https://source-two-${suffix}.example.com`,
        trustScore: 67,
        language: "en",
        enabled: true,
        fetchMethod: "json",
        pollIntervalMinutes: 180,
      },
      {
        name: `Source Three ${suffix}`,
        sourceType: "forum",
        baseUrl: `https://source-three-${suffix}.example.com`,
        trustScore: 54,
        language: "zh",
        enabled: false,
        fetchMethod: "html",
        pollIntervalMinutes: 720,
      },
    ];

    await prisma.source.createMany({ data: seeded });
    const created = await prisma.source.findMany({
      where: { baseUrl: { in: seeded.map((source) => source.baseUrl) } },
      orderBy: { baseUrl: "asc" },
      select: {
        id: true,
        name: true,
        sourceType: true,
        baseUrl: true,
        trustScore: true,
        language: true,
        enabled: true,
        fetchMethod: true,
        pollIntervalMinutes: true,
        pollCount: true,
        lastPolledAt: true,
        lastPollStatus: true,
        lastPollMessage: true,
        lastLeadCreatedAt: true,
      },
    });

    const app = buildApp({
      sourceStore: {
        list: listSources,
        update: updateSource,
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
        body: {
          enabled: false,
          fetchMethod: "html",
          pollIntervalMinutes: 30,
        },
      });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body).toMatchObject({
        ...target,
        enabled: false,
        fetchMethod: "html",
        pollIntervalMinutes: 30,
      });

      const persisted = await prisma.source.findUnique({
        where: { id: target.id },
        select: {
          enabled: true,
          fetchMethod: true,
          pollIntervalMinutes: true,
        },
      });

      expect(persisted).toEqual({
        enabled: false,
        fetchMethod: "html",
        pollIntervalMinutes: 30,
      });
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

  it("polls a disabled source immediately, creates leads, and updates poll metadata", async () => {
    const suffix = randomUUID();
    const seeded = await prisma.source.create({
      data: {
        name: `Poll Source ${suffix}`,
        sourceType: "community",
        baseUrl: `https://poll-source-${suffix}.example.com`,
        trustScore: 84,
        language: "en-AU",
        enabled: false,
        fetchMethod: "html",
        pollIntervalMinutes: 720,
        pollCount: 3,
        lastPolledAt: new Date("2026-04-20T00:00:00.000Z"),
        lastPollStatus: "error",
        lastPollMessage: "Source fetch failed: 500",
        lastLeadCreatedAt: null,
      },
      select: {
        id: true,
        baseUrl: true,
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `
          <a href="/deal/switch">Nintendo Switch OLED for A$399 at Amazon AU</a>
          <a href="/deal/airpods">AirPods Pro (2nd Gen) for A$299 at Amazon AU</a>
        `,
        headers: {
          get(name: string) {
            return name.toLowerCase() === "content-type" ? "text/html" : null;
          },
        },
      }),
    );

    const app = buildApp();

    try {
      const response = await dispatchRequest(app, {
        method: "POST",
        path: `/v1/admin/sources/${seeded.id}/poll`,
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        createdLeadCount: 2,
        status: "ok",
        message: "Fetched 2 candidates; created 2 leads.",
        source: {
          id: seeded.id,
          baseUrl: seeded.baseUrl,
          enabled: false,
          pollCount: 4,
          lastPollStatus: "ok",
          lastPollMessage: "Fetched 2 candidates; created 2 leads.",
          lastPolledAt: expect.any(String),
          lastLeadCreatedAt: expect.any(String),
        },
      });

      const persisted = await prisma.source.findUnique({
        where: { id: seeded.id },
        select: {
          enabled: true,
          pollCount: true,
          lastPollStatus: true,
          lastPollMessage: true,
          lastPolledAt: true,
          lastLeadCreatedAt: true,
        },
      });

      expect(persisted).toMatchObject({
        enabled: false,
        pollCount: 4,
        lastPollStatus: "ok",
        lastPollMessage: "Fetched 2 candidates; created 2 leads.",
      });
      expect(persisted?.lastPolledAt).toBeInstanceOf(Date);
      expect(persisted?.lastLeadCreatedAt).toBeInstanceOf(Date);

      const leads = await prisma.lead.findMany({
        where: {
          sourceId: seeded.id,
        },
        orderBy: {
          canonicalUrl: "asc",
        },
        select: {
          canonicalUrl: true,
          originalTitle: true,
        },
      });

      expect(leads).toEqual([
        {
          canonicalUrl: `${seeded.baseUrl}/deal/airpods`,
          originalTitle: "AirPods Pro (2nd Gen) for A$299 at Amazon AU",
        },
        {
          canonicalUrl: `${seeded.baseUrl}/deal/switch`,
          originalTitle: "Nintendo Switch OLED for A$399 at Amazon AU",
        },
      ]);
    } finally {
      await prisma.source.deleteMany({
        where: {
          id: seeded.id,
        },
      });
    }
  });
});
