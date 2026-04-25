import { Router } from "express";

import type { SessionManager } from "./auth.ts";

export interface DigestPreferencesRecord {
  categories: string[];
  frequency: string;
  locale: string;
}

export interface DigestPreferencesStore {
  getByEmail(email: string): Promise<DigestPreferencesRecord | null>;
  upsertByEmail(
    email: string,
    input: DigestPreferencesRecord,
  ): Promise<DigestPreferencesRecord>;
}

const defaultDigestPreferences: DigestPreferencesRecord = {
  locale: "en",
  frequency: "daily",
  categories: [],
};

function toDigestFrequency(value: string) {
  return value === "weekly" ? "weekly" : "daily";
}

function normalizeDigestPreferences(
  value: DigestPreferencesRecord,
): DigestPreferencesRecord {
  return {
    locale: value.locale,
    frequency: toDigestFrequency(value.frequency),
    categories: value.categories,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDigestPreferencesInput(value: unknown): value is DigestPreferencesRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    isNonEmptyString(candidate.locale) &&
    isNonEmptyString(candidate.frequency) &&
    Array.isArray(candidate.categories) &&
    candidate.categories.every((category) => typeof category === "string")
  );
}

export function createDigestPreferencesRouter(
  sessionManager: SessionManager,
  store: DigestPreferencesStore,
) {
  const router = Router();

  router.get("/", async (request, response) => {
    const session = sessionManager.readSession(request.header("x-session-token") ?? undefined);

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const preferences = await store.getByEmail(session.email);
    response.json(
      preferences ? normalizeDigestPreferences(preferences) : defaultDigestPreferences,
    );
  });

  router.put("/", async (request, response) => {
    const session = sessionManager.readSession(request.header("x-session-token") ?? undefined);

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const input = request.body as DigestPreferencesRecord | undefined;

    if (!isDigestPreferencesInput(input)) {
      response.status(400).json({ message: "Digest preferences are invalid." });
      return;
    }

    const preferences = await store.upsertByEmail(
      session.email,
      normalizeDigestPreferences(input),
    );
    response.json(normalizeDigestPreferences(preferences));
  });

  return router;
}
