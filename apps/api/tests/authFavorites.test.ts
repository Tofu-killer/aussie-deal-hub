import { EventEmitter } from "node:events";

import { createRequest, createResponse } from "node-mocks-http";
import type { Express } from "express";
import { describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

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

  return {
    status: response.statusCode,
    body: response._getJSONData(),
  };
}

describe("auth and favorites", () => {
  const validDealId = "nintendo-switch-oled-amazon-au";

  it("consumes a one-time code after successful verification", async () => {
    const app = buildApp();

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
    const app = buildApp();

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
    const app = buildApp();

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

  it("keeps favorites when the same email signs in again", async () => {
    const app = buildApp();

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
    const app = buildApp();

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
    const app = buildApp();

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
});
