import { Router } from "express";

import type { SessionRecord } from "./auth.ts";

interface CreateFavoriteInput {
  dealId: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isCreateFavoriteInput(value: unknown): value is CreateFavoriteInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  return isNonEmptyString((value as Record<string, unknown>).dealId);
}

function readAuthorizedSessionToken(
  headerValue: string | undefined,
  sessions: Map<string, SessionRecord>,
) : SessionRecord | undefined {
  if (!headerValue || !sessions.has(headerValue)) {
    return undefined;
  }

  return sessions.get(headerValue);
}

export function createFavoritesRouter(
  sessions: Map<string, SessionRecord>,
  favorites: Map<string, string[]>,
  publishedDealIds: Set<string>,
) {
  const router = Router();

  router.get("/", (request, response) => {
    const session = readAuthorizedSessionToken(
      request.header("x-session-token") ?? undefined,
      sessions,
    );

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    response.json({
      items: (favorites.get(session.email) ?? []).map((dealId) => ({ dealId })),
    });
  });

  router.post("/", (request, response) => {
    const session = readAuthorizedSessionToken(
      request.header("x-session-token") ?? undefined,
      sessions,
    );

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const input = request.body as CreateFavoriteInput | undefined;

    if (!isCreateFavoriteInput(input)) {
      response.status(400).json({ message: "Deal ID is required." });
      return;
    }

    if (!publishedDealIds.has(input.dealId)) {
      response.status(400).json({ message: "Deal ID is invalid." });
      return;
    }

    const sessionFavorites = favorites.get(session.email) ?? [];

    if (!sessionFavorites.includes(input.dealId)) {
      sessionFavorites.push(input.dealId);
      favorites.set(session.email, sessionFavorites);
    }

    response.status(201).json({ dealId: input.dealId });
  });

  return router;
}
