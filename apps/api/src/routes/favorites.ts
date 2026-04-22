import { Router } from "express";

import { listFavoritesByEmail, upsertFavorite } from "@aussie-deal-hub/db/repositories/favorites";
import type { SessionRecord } from "./auth.ts";

export interface FavoriteRecord {
  dealId: string;
}

export interface FavoritesStore {
  listByEmail(email: string): Promise<FavoriteRecord[]>;
  saveFavorite(email: string, dealId: string): Promise<FavoriteRecord>;
}

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
  publishedDealIds: Set<string>,
  store: FavoritesStore = {
    listByEmail: listFavoritesByEmail,
    saveFavorite(email, dealId) {
      return upsertFavorite({ email, dealId });
    },
  },
) {
  const router = Router();

  router.get("/", async (request, response) => {
    const session = readAuthorizedSessionToken(
      request.header("x-session-token") ?? undefined,
      sessions,
    );

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const favorites = await store.listByEmail(session.email);

    response.json({
      items: favorites,
    });
  });

  router.post("/", async (request, response) => {
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

    await store.saveFavorite(session.email, input.dealId);

    response.status(201).json({ dealId: input.dealId });
  });

  return router;
}
