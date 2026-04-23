import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import { createRequest, createResponse } from "node-mocks-http";
import type { Express } from "express";
import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import {
  getDigestSubscription,
  upsertDigestSubscription,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";
import { listPriceSnapshotsForDeal } from "@aussie-deal-hub/db/repositories/priceSnapshots";
import { buildApp } from "../src/app";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

interface AppRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function dispatchRequest(app: Express, request: AppRequest) {
  const req = createRequest({
    method: request.method,
    url: request.path,
    headers: {
      "content-type": "application/json",
      ...request.headers,
    },
    body: request.body,
  });
  const response = createResponse({
    eventEmitter: EventEmitter,
  });

  await new Promise<void>((resolve) => {
    response.on("end", () => resolve());
    app.handle(req, response);
  });

  const bodyText = response._getData();

  return {
    status: response.statusCode,
    body: bodyText ? response._getJSONData() : undefined,
  };
}

async function signIn(app: Express, email: string) {
  await dispatchRequest(app, {
    method: "POST",
    path: "/v1/auth/request-code",
    body: { email },
  });

  const verify = await dispatchRequest(app, {
    method: "POST",
    path: "/v1/auth/verify-code",
    body: {
      email,
      code: "123456",
    },
  });

  expect(verify.status).toBe(200);

  return (verify.body as { sessionToken: string }).sessionToken;
}

describeDb("favorites persistence", () => {
  const validDealId = "nintendo-switch-oled-amazon-au";

  it("keeps favorites across normalized email variants and persists digest preferences", async () => {
    const baseEmail = `shopper.${randomUUID()}@example.com`;
    const upperEmail = `  ${baseEmail.toUpperCase()}  `;
    const app = buildApp({
      digestPreferencesStore: {
        getByEmail: getDigestSubscription,
        upsertByEmail(email, input) {
          return upsertDigestSubscription({ email, ...input });
        },
      },
      priceSnapshotStore: {
        listSnapshotsForDeal: listPriceSnapshotsForDeal,
      },
    });

    try {
      const firstSessionToken = await signIn(app, upperEmail);

      const favorite = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/favorites",
        body: { dealId: validDealId },
        headers: {
          "x-session-token": firstSessionToken,
        },
      });

      expect(favorite.status).toBe(201);

      const secondSessionToken = await signIn(app, baseEmail);

      const favorites = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/favorites",
        headers: {
          "x-session-token": secondSessionToken,
        },
      });

      expect(favorites.status).toBe(200);
      expect(favorites.body).toEqual({
        items: [{ dealId: validDealId }],
      });

      const removedFavorite = await dispatchRequest(app, {
        method: "DELETE",
        path: `/v1/favorites/${validDealId}`,
        headers: {
          "x-session-token": secondSessionToken,
        },
      });

      expect(removedFavorite.status).toBe(204);

      const favoritesAfterRemove = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/favorites",
        headers: {
          "x-session-token": secondSessionToken,
        },
      });

      expect(favoritesAfterRemove.status).toBe(200);
      expect(favoritesAfterRemove.body).toEqual({
        items: [],
      });

      const defaults = await dispatchRequest(app, {
        method: "GET",
        path: "/v1/digest-preferences",
        headers: {
          "x-session-token": secondSessionToken,
        },
      });

      expect(defaults.status).toBe(200);
      expect(defaults.body).toEqual({
        locale: "en",
        frequency: "daily",
        categories: [],
      });

      const updatedPreferences = await dispatchRequest(app, {
        method: "PUT",
        path: "/v1/digest-preferences",
        body: {
          locale: "zh",
          frequency: "daily",
          categories: ["deals", "historical-lows"],
        },
        headers: {
          "x-session-token": secondSessionToken,
        },
      });

      expect(updatedPreferences.status).toBe(200);
      expect(updatedPreferences.body).toEqual({
        locale: "zh",
        frequency: "daily",
        categories: ["deals", "historical-lows"],
      });

      const persistedPreferences = await getDigestSubscription(baseEmail);

      expect(persistedPreferences).toEqual({
        locale: "zh",
        frequency: "daily",
        categories: ["deals", "historical-lows"],
      });
    } finally {
      await prisma.favorite.deleteMany({
        where: {
          normalizedEmail: baseEmail.trim().toLowerCase(),
        },
      });
      await prisma.emailDigestSubscription.deleteMany({
        where: {
          normalizedEmail: baseEmail.trim().toLowerCase(),
        },
      });
    }
  });
});
