import { EventEmitter } from "node:events";

import { createRequest, createResponse } from "node-mocks-http";
import type { Express } from "express";
import { describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app";
import type { FavoritesStore } from "../src/routes/favorites";
import { createSignedSessionManager } from "../src/routes/auth";

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

interface SentVerificationCode {
  email: string;
  code: string;
  ttlMs: number;
}

function createCapturingAuthCodeSender() {
  const sent: SentVerificationCode[] = [];

  return {
    sent,
    sender: {
      async sendVerificationCode(message: SentVerificationCode) {
        sent.push(message);
      },
    },
  };
}

function createAuthApp(options: Record<string, unknown> = {}) {
  const capture = createCapturingAuthCodeSender();

  return {
    capture,
    app: buildApp({
      authCodeSender: capture.sender,
      ...options,
    } as never),
  };
}

async function requestVerificationCode(
  app: Express,
  capture: ReturnType<typeof createCapturingAuthCodeSender>,
  email: string,
) {
  const requestCode = await dispatchRequest(app, {
    method: "POST",
    path: "/v1/auth/request-code",
    body: {
      email,
    },
  });

  expect(requestCode.status).toBe(200);

  const sentCode = capture.sent.at(-1);

  expect(sentCode).toMatchObject({
    email,
    code: expect.stringMatching(/^\d{6}$/),
    ttlMs: 10 * 60 * 1000,
  });

  return sentCode!.code;
}

async function createAuthenticatedSession(
  app: Express,
  capture: ReturnType<typeof createCapturingAuthCodeSender>,
  email: string,
) {
  const code = await requestVerificationCode(app, capture, email);
  const verify = await dispatchRequest(app, {
    method: "POST",
    path: "/v1/auth/verify-code",
    body: {
      email,
      code,
    },
  });

  expect(verify.status).toBe(200);
  expect(verify.body).toMatchObject({
    sessionToken: expect.any(String),
  });

  return {
    code,
    sessionToken: (verify.body as { sessionToken: string }).sessionToken,
  };
}

describe("auth and favorites", () => {
  const validDealId = "nintendo-switch-oled-amazon-au";

  it("sends a generated verification code instead of accepting the legacy fixed code", async () => {
    const capture = createCapturingAuthCodeSender();
    const app = buildApp({
      favoritesStore: createInMemoryFavoritesStore(),
      authCodeGenerator: () => "654321",
      authCodeSender: capture.sender,
    } as never);

    const requestCode = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    expect(requestCode.status).toBe(200);
    expect(capture.sent).toEqual([
      {
        email: "user@example.com",
        code: "654321",
        ttlMs: 10 * 60 * 1000,
      },
    ]);

    const legacyVerify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "123456",
      },
    });

    expect(legacyVerify.status).toBe(401);
    expect(legacyVerify.body).toMatchObject({
      message: "Invalid code.",
    });

    const verify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "654321",
      },
    });

    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({
      sessionToken: expect.any(String),
    });
  });

  it("rejects expired verification codes after the configured ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    try {
      const capture = createCapturingAuthCodeSender();
      const app = buildApp({
        favoritesStore: createInMemoryFavoritesStore(),
        authCodeGenerator: () => "654321",
        authCodeSender: capture.sender,
        authCodeTtlMs: 1_000,
      } as never);

      await dispatchRequest(app, {
        method: "POST",
        path: "/v1/auth/request-code",
        body: {
          email: "user@example.com",
        },
      });

      vi.advanceTimersByTime(1_001);

      const verify = await dispatchRequest(app, {
        method: "POST",
        path: "/v1/auth/verify-code",
        body: {
          email: "user@example.com",
          code: "654321",
        },
      });

      expect(capture.sent).toHaveLength(1);
      expect(verify.status).toBe(401);
      expect(verify.body).toMatchObject({
        message: "Code expired.",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails request-code clearly when email delivery is unavailable", async () => {
    const app = buildApp({
      favoritesStore: createInMemoryFavoritesStore(),
      authCodeGenerator: () => "654321",
      authCodeSender: {
        async sendVerificationCode() {
          throw new Error("smtp unavailable");
        },
      },
    } as never);

    const requestCode = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/request-code",
      body: {
        email: "user@example.com",
      },
    });

    expect(requestCode.status).toBe(503);
    expect(requestCode.body).toMatchObject({
      message: "Unable to deliver verification code.",
    });

    const verify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code: "654321",
      },
    });

    expect(verify.status).toBe(401);
    expect(verify.body).toMatchObject({
      message: "Invalid code.",
    });
  });

  it("consumes a one-time code after successful verification", async () => {
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });
    const code = await requestVerificationCode(app, capture, "user@example.com");

    const firstVerify = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/auth/verify-code",
      body: {
        email: "user@example.com",
        code,
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
        code,
      },
    });

    expect(secondVerify.status).toBe(401);
    expect(secondVerify.body).toMatchObject({
      message: "Invalid code.",
    });
  });

  it("rejects invalid codes and unauthorized favorite writes", async () => {
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });

    await requestVerificationCode(app, capture, "user@example.com");

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
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });
    const { sessionToken } = await createAuthenticatedSession(app, capture, "user@example.com");

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
    expect(favorite.body).toMatchObject({
      dealId: validDealId,
    });

    const favorites = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual({
      items: [{ dealId: validDealId }],
    });
  });

  it("removes a favorite for the active session and excludes it from later lists", async () => {
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });
    const { sessionToken } = await createAuthenticatedSession(app, capture, "user@example.com");

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
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });
    const { sessionToken } = await createAuthenticatedSession(app, capture, "user@example.com");

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
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });
    const firstSession = await createAuthenticatedSession(app, capture, "user@example.com");

    await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: validDealId,
      },
      headers: {
        "x-session-token": firstSession.sessionToken,
      },
    });

    const secondSession = await createAuthenticatedSession(app, capture, "user@example.com");

    const favorites = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": secondSession.sessionToken,
      },
    });

    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual({
      items: [{ dealId: validDealId }],
    });
  });

  it("keeps a signed session valid after rebuilding the app with the same secret", async () => {
    const favoritesStore = createInMemoryFavoritesStore();
    const sessionManager = createSignedSessionManager("test-session-secret");
    const capture = createCapturingAuthCodeSender();
    const app = buildApp({
      favoritesStore,
      authCodeSender: capture.sender,
      sessionManager,
    });
    const verify = await createAuthenticatedSession(app, capture, "user@example.com");

    const rebuiltApp = buildApp({
      favoritesStore,
      authCodeSender: capture.sender,
      sessionManager: createSignedSessionManager("test-session-secret"),
    });

    const favorite = await dispatchRequest(rebuiltApp, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: validDealId,
      },
      headers: {
        "x-session-token": verify.sessionToken,
      },
    });

    expect(favorite.status).toBe(201);
  });

  it("rejects invalid deal IDs before persisting favorites", async () => {
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });

    await createAuthenticatedSession(app, capture, "user@example.com");
    const verifiedSession = await createAuthenticatedSession(app, capture, "second@example.com");

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: "",
      },
      headers: {
        "x-session-token": verifiedSession.sessionToken,
      },
    });

    expect(favorite.status).toBe(400);
    expect(favorite.body).toMatchObject({
      message: "Deal ID is required.",
    });
  });

  it("rejects favorite writes for unknown published deals", async () => {
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
    });
    const verifiedSession = await createAuthenticatedSession(app, capture, "user@example.com");

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: "unknown-deal",
      },
      headers: {
        "x-session-token": verifiedSession.sessionToken,
      },
    });

    expect(favorite.status).toBe(400);
    expect(favorite.body).toMatchObject({
      message: "Deal ID is invalid.",
    });
  });

  it("accepts favorite writes for persisted published deal slugs", async () => {
    const persistedDealSlug = "breville-barista-express-for-a-499";
    const capture = createCapturingAuthCodeSender();
    const app = buildApp({
      authCodeSender: capture.sender,
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
    const verifiedSession = await createAuthenticatedSession(app, capture, "user@example.com");

    const favorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: persistedDealSlug,
      },
      headers: {
        "x-session-token": verifiedSession.sessionToken,
      },
    });

    expect(favorite.status).toBe(201);
    expect(favorite.body).toMatchObject({
      dealId: persistedDealSlug,
    });
  });

  it("canonicalizes sibling locale slugs so one published deal only persists once", async () => {
    const canonicalDealSlug = "lego-bonsai-tree-for-a-59-at-big-w";
    const localizedDealSlug = "big-w-乐高盆景树套装-a-59";
    const { app, capture } = createAuthApp({
      favoritesStore: createInMemoryFavoritesStore(),
      publishedDealStore: {
        async getPublishedDeal() {
          return null;
        },
        async hasPublishedDealSlug(slug: string) {
          return slug === canonicalDealSlug || slug === localizedDealSlug;
        },
        async getCanonicalPublishedDealSlug(slug: string) {
          return slug === canonicalDealSlug || slug === localizedDealSlug ? canonicalDealSlug : null;
        },
        async listEquivalentPublishedDealSlugs(slug: string) {
          return slug === canonicalDealSlug || slug === localizedDealSlug
            ? [canonicalDealSlug, localizedDealSlug]
            : [];
        },
      },
    } as never);
    const { sessionToken } = await createAuthenticatedSession(app, capture, "user@example.com");

    const localizedFavorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: localizedDealSlug,
      },
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(localizedFavorite.status).toBe(201);
    expect(localizedFavorite.body).toEqual({
      dealId: canonicalDealSlug,
    });

    const canonicalFavorite = await dispatchRequest(app, {
      method: "POST",
      path: "/v1/favorites",
      body: {
        dealId: canonicalDealSlug,
      },
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(canonicalFavorite.status).toBe(201);
    expect(canonicalFavorite.body).toEqual({
      dealId: canonicalDealSlug,
    });

    const favorites = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(favorites.status).toBe(200);
    expect(favorites.body).toEqual({
      items: [{ dealId: canonicalDealSlug }],
    });

    const deleted = await dispatchRequest(app, {
      method: "DELETE",
      path: `/v1/favorites/${encodeURIComponent(canonicalDealSlug)}`,
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(deleted.status).toBe(204);

    const favoritesAfterDelete = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/favorites",
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(favoritesAfterDelete.status).toBe(200);
    expect(favoritesAfterDelete.body).toEqual({
      items: [],
    });
  });
});
