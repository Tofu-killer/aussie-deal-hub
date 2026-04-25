import express from "express";
import { describe, expect, it, vi } from "vitest";

import { createInMemorySessionManager } from "../src/routes/auth";
import {
  createDigestPreferencesRouter,
  type DigestPreferencesRecord,
  type DigestPreferencesStore,
} from "../src/routes/digestPreferences";
import { dispatchRequest } from "./httpHarness";

function createDigestPreferencesApp(store: DigestPreferencesStore) {
  const sessionManager = createInMemorySessionManager();
  const sessionToken = sessionManager.issueSession("user@example.com");
  const app = express();

  app.use(express.json());
  app.use("/v1/digest-preferences", createDigestPreferencesRouter(sessionManager, store));

  return { app, sessionToken };
}

describe("digest preferences route", () => {
  it("normalizes persisted non-weekly frequencies to daily on read", async () => {
    const store = {
      getByEmail: vi.fn(async () => ({
        locale: "zh",
        frequency: "monthly",
        categories: ["deals"],
      })),
      upsertByEmail: vi.fn(),
    } satisfies DigestPreferencesStore;
    const { app, sessionToken } = createDigestPreferencesApp(store);

    const response = await dispatchRequest(app, {
      method: "GET",
      path: "/v1/digest-preferences",
      headers: {
        "x-session-token": sessionToken,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      locale: "zh",
      frequency: "daily",
      categories: ["deals"],
    });
  });

  it("preserves weekly updates and coerces other string frequencies to daily before persisting", async () => {
    const savedRecords: DigestPreferencesRecord[] = [];
    const store = {
      getByEmail: vi.fn(async () => null),
      upsertByEmail: vi.fn(async (_email, input) => {
        savedRecords.push(input);
        return input;
      }),
    } satisfies DigestPreferencesStore;
    const { app, sessionToken } = createDigestPreferencesApp(store);

    const weeklyResponse = await dispatchRequest(app, {
      method: "PUT",
      path: "/v1/digest-preferences",
      headers: {
        "x-session-token": sessionToken,
      },
      body: {
        locale: "zh",
        frequency: "weekly",
        categories: ["deals"],
      },
    });

    expect(weeklyResponse.status).toBe(200);
    expect(weeklyResponse.body).toEqual({
      locale: "zh",
      frequency: "weekly",
      categories: ["deals"],
    });

    const coercedResponse = await dispatchRequest(app, {
      method: "PUT",
      path: "/v1/digest-preferences",
      headers: {
        "x-session-token": sessionToken,
      },
      body: {
        locale: "zh",
        frequency: "monthly",
        categories: ["historical-lows"],
      },
    });

    expect(coercedResponse.status).toBe(200);
    expect(coercedResponse.body).toEqual({
      locale: "zh",
      frequency: "daily",
      categories: ["historical-lows"],
    });
    expect(savedRecords).toEqual([
      {
        locale: "zh",
        frequency: "weekly",
        categories: ["deals"],
      },
      {
        locale: "zh",
        frequency: "daily",
        categories: ["historical-lows"],
      },
    ]);
  });
});
