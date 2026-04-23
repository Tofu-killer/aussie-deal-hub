import { Router } from "express";

import {
  deleteFavorite as deleteFavoriteRecord,
  listFavoritesByEmail,
  upsertFavorite,
} from "@aussie-deal-hub/db/repositories/favorites";
import type { SessionRecord } from "./auth.ts";
import type { PublishedDealReader } from "./publicDeals.ts";

export interface FavoriteRecord {
  dealId: string;
}

export interface FavoritesStore {
  listByEmail(email: string): Promise<FavoriteRecord[]>;
  saveFavorite(email: string, dealId: string): Promise<FavoriteRecord>;
  deleteFavorite(email: string, dealId: string): Promise<void>;
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

async function hasPublishedDealSlug(
  store: Pick<PublishedDealReader, "hasPublishedDealSlug"> | Set<string>,
  slug: string,
) {
  return store instanceof Set ? store.has(slug) : store.hasPublishedDealSlug(slug);
}

export function createFavoritesRouter(
  sessions: Map<string, SessionRecord>,
  publishedDealStore: Pick<PublishedDealReader, "hasPublishedDealSlug"> | Set<string>,
  store: FavoritesStore = {
    listByEmail: listFavoritesByEmail,
    saveFavorite(email, dealId) {
      return upsertFavorite({ email, dealId });
    },
    deleteFavorite(email, dealId) {
      return deleteFavoriteRecord({ email, dealId });
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

    const favorites = (await store.listByEmail(session.email)).slice().sort((left, right) => {
      return left.dealId.localeCompare(right.dealId);
    });

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

    if (!(await hasPublishedDealSlug(publishedDealStore, input.dealId))) {
      response.status(400).json({ message: "Deal ID is invalid." });
      return;
    }

    await store.saveFavorite(session.email, input.dealId);

    response.status(201).json({ dealId: input.dealId });
  });

  router.delete("/:dealId", async (request, response) => {
    const session = readAuthorizedSessionToken(
      request.header("x-session-token") ?? undefined,
      sessions,
    );

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const dealId = request.params.dealId;

    if (!isNonEmptyString(dealId)) {
      response.status(400).json({ message: "Deal ID is required." });
      return;
    }

    await store.deleteFavorite(session.email, dealId);

    response.status(204).send();
  });

  return router;
}
