import { EventEmitter } from "node:events";

import { createRequest, createResponse } from "node-mocks-http";
import type { Express } from "express";
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";
import type { FavoritesStore } from "../src/routes/favorites";

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

function createInMemoryFavoritesStore(): FavoritesStore {
  const favorites = new Map<string, string[]>();

  return {
    async listByEmail(email) {
      return (favorites.get(email.trim().toLowerCase()) ?? []).map((dealId) => ({ dealId }));
    },
    async saveFavorite(email, dealId) {
      const normalizedEmail = email.trim().toLowerCase();
      const bucket = favorites.get(normalizedEmail) ?? [];

      if (!bucket.includes(dealId)) {
        bucket.push(dealId);
        favorites.set(normalizedEmail, bucket);
      }

      return { dealId };
    },
    async deleteFavorite(email, dealId) {
      const normalizedEmail = email.trim().toLowerCase();
      const bucket = favorites.get(normalizedEmail) ?? [];

      favorites.set(
        normalizedEmail,
        bucket.filter((favoriteDealId) => favoriteDealId !== dealId),
      );
    },
  };
}

describe("auth and favorites", () => {
  const validDealId = "nintendo-switch-oled-amazon-au";

  it("consumes a one-time code after successful verification", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const firstVerify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    expect(firstVerify.status).toBe(200);
    expect(firstVerify.body).toMatchObject({
      sessionToken: expect.any(String),
    });

    const secondVerify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    expect(secondVerify.status).toBe(401);
    expect(secondVerify.body).toMatchObject({
      message: "Invalid code.",
    });
  });

  it("rejects invalid codes and unauthorized favorite writes", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    const requestCode = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    expect(requestCode.status).toBe(200);

    const verify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "000000",
      },
    });

    expect(verify.status).toBe(401);
    expect(verify.body).toMatchObject({
      message: "Invalid code.",
    });

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: validDealId,
      },
    });

    expect(favorite.status).toBe(401);
    expect(favorite.body).toMatchObject({
      message: "Unauthorized.",
    });
  });

  it("verifies an email code and persists a favorite for the session", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    const requestCode = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    expect(requestCode.status).toBe(200);
    expect(requestCode.body).toMatchObject({
      ok: true,
    });

    const verify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({
      sessionToken: expect.any(String),
    });
    expect((verify.body as { sessionToken: string }).sessionToken).not.toBe("session_1");

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: validDealId,
      },
      headers: {
        "x-session-token": (verify.body as { sessionToken: string }).sessionToken,
      },
    });

    expect(favorite.status).toBe(201);
    expect(favorite.body).toMatchObject({
      dealId: validDealId,
    });

    const favorites = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": (verify.body as { sessionToken: string }).sessionToken,
      },
    });

    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual({
      items: [{ dealId: validDealId }],
    });
  });

  it("removes a favorite for the active session and excludes it from later lists", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const verify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });
    const sessionToken = (verify.body as { sessionToken: string }).sessionToken;

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: validDealId,
      },
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(favorite.status).toBe(201);

    const deleted = await dispatchRequest(app, {
      method: "DELETE",
      path: `/v1/favorites/${validDealId}`,
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(deleted.status).toBe(204);

    const favorites = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual({
      items: [],
    });
  });

  it("returns default digest preferences and persists updates for the session email", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const verify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    const sessionToken = (verify.body as { sessionToken: string }).sessionToken;

    const defaults = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/digest-preferences",
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(defaults.status).toBe(200);
    expect(defaults.body).toEqual({
      locale: "en",
      frequency: "daily",
      categories: [],
    });

    const updated = await dispatchRequest(app, {
      method: "PUT",
      path: "/v1/digest-preferences",
      headers: {
        "x-session-token": sessionToken,
      },
      body: {
        locale: "zh",
        frequency: "daily",
        categories: ["deals", "historical-lows"],
      },
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({
      locale: "zh",
      frequency: "daily",
      categories: ["deals", "historical-lows"],
    });
  });

  it("keeps favorites when the same email signs in again", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const firstSession = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: validDealId,
      },
      headers: {
        "x-session-token": (firstSession.body as { sessionToken: string }).sessionToken,
      },
    });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const secondSession = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    const favorites = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": (secondSession.body as { sessionToken: string }).sessionToken,
      },
    });

    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual({
      items: [{ dealId: validDealId }],
    });
  });

  it("rejects invalid deal IDs before persisting favorites", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });
    const secondVerify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "second@example.com",
      },
    });

    expect(secondVerify.status).toBe(200);

    const verifiedSession = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "second@example.com",
        code: "123456",
      },
    });

    expect(verifiedSession.status).toBe(200);

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: "",
      },
      headers: {
        "x-session-token": (verifiedSession.body as { sessionToken: string }).sessionToken,
      },
    });

    expect(favorite.status).toBe(400);
    expect(favorite.body).toMatchObject({
      message: "Deal ID is required.",
    });
  });

  it("rejects favorite writes for unknown published deals", async () => {
    const app = buildApp({ favoritesStore: createInMemoryFavoritesStore() });

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const verifiedSession = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: "unknown-deal",
      },
      headers: {
        "x-session-token": (verifiedSession.body as { sessionToken: string }).sessionToken,
      },
    });

    expect(favorite.status).toBe(400);
    expect(favorite.body).toMatchObject({
      message: "Deal ID is invalid.",
    });
  });

  it("accepts favorite writes for persisted published deal slugs", async () => {
    const persistedDealSlug = "breville-barista-express-for-a-499";
    const app = buildApp({
      favoritesStore: createInMemoryFavoritesStore(),
      publishedDealStore: {
        async getPublishedDeal() {
          return null;
        },
        async hasPublishedDealSlug(slug: string) {
          return slug === persistedDealSlug;
        },
      },
    } as never);

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    const verifiedSession = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: persistedDealSlug,
      },
      headers: {
        "x-session-token": (verifiedSession.body as { sessionToken: string }).sessionToken,
      },
    });

    expect(favorite.status).toBe(201);
    expect(favorite.body).toMatchObject({
      dealId: persistedDealSlug,
    });
  });
});
