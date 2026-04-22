import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import { describe, expect, it } from "vitest";

import { prisma } from "@aussie-deal-hub/db/client";
import {
  getDigestSubscription,
  upsertDigestSubscription,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";
import { buildApp } from "../src/app";

interface HttpClient {
  request: (
    path: string,
    init?: {
      body?: unknown;
      headers?: Record<string, string>;
      method?: string;
    },
  ) => Promise<{ status: number; body: unknown }>;
  close: () => Promise<void>;
}

async function createHttpClient(): Promise<HttpClient> {
  const app = buildApp();
  const server = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    async request(path, init = {}) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...init.headers,
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const text = await response.text();
      let body: unknown = text;

      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      return {
        status: response.status,
        body,
      };
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

async function signIn(client: HttpClient, email: string) {
  await client.request("/v1/auth/request-code", {
    method: "POST",
    body: { email },
  });

  const verify = await client.request("/v1/auth/verify-code", {
    method: "POST",
    body: {
      email,
      code: "123456",
    },
  });

  expect(verify.status).toBe(200);

  return (verify.body as { sessionToken: string }).sessionToken;
}

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;

describeDb("favorites persistence", () => {
  const validDealId = "nintendo-switch-oled-amazon-au";

  it("keeps favorites across normalized email variants and persists digest preferences", async () => {
    const baseEmail = `shopper.${randomUUID()}@example.com`;
    const upperEmail = `  ${baseEmail.toUpperCase()}  `;
    const firstClient = await createHttpClient();
    let secondClient: HttpClient | null = null;

    try {
      const firstSessionToken = await signIn(firstClient, upperEmail);

      const favorite = await firstClient.request("/v1/favorites", {
        method: "POST",
        body: {
          dealId: validDealId,
        },
        headers: {
          "x-session-token": firstSessionToken,
        },
      });

      expect(favorite.status).toBe(201);

      await firstClient.close();

      secondClient = await createHttpClient();
      const secondSessionToken = await signIn(secondClient, baseEmail);

      const favorites = await secondClient.request("/v1/favorites", {
        headers: {
          "x-session-token": secondSessionToken,
        },
      });

      expect(favorites.status).toBe(200);
      expect(favorites.body).toEqual({
        items: [{ dealId: validDealId }],
      });

      await secondClient.close();

      await upsertDigestSubscription({
        email: upperEmail,
        locale: "zh",
        frequency: "daily",
        categories: ["deals", "historical-lows"],
      });

      const subscription = await getDigestSubscription(baseEmail);

      expect(subscription).toEqual({
        locale: "zh",
        frequency: "daily",
        categories: ["deals", "historical-lows"],
      });
    } finally {
      await prisma.favorite.deleteMany({
        where: {
          normalizedEmail: baseEmail,
        },
      });
      await prisma.emailDigestSubscription.deleteMany({
        where: {
          normalizedEmail: baseEmail,
        },
      });
      await secondClient?.close().catch(() => undefined);
      await firstClient.close().catch(() => undefined);
    }
  });
});
