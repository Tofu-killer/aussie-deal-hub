import { Router } from "express";

import {
  deleteFavorite as deleteFavoriteRecord,
  listFavoritesByEmail,
  upsertFavorite,
} from "@aussie-deal-hub/db/repositories/favorites";
import type { SessionManager } from "./auth.ts";
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

async function hasPublishedDealSlug(
  store: Pick<PublishedDealReader, "hasPublishedDealSlug"> | Set<string>,
  slug: string,
) {
  return store instanceof Set ? store.has(slug) : store.hasPublishedDealSlug(slug);
}

async function getCanonicalPublishedDealSlug(
  store:
    | Pick<PublishedDealReader, "hasPublishedDealSlug" | "getCanonicalPublishedDealSlug">
    | Set<string>,
  slug: string,
) {
  if (store instanceof Set) {
    return store.has(slug) ? slug : null;
  }

  if (store.getCanonicalPublishedDealSlug) {
    return store.getCanonicalPublishedDealSlug(slug);
  }

  return (await store.hasPublishedDealSlug(slug)) ? slug : null;
}

async function listEquivalentPublishedDealSlugs(
  store:
    | Pick<PublishedDealReader, "hasPublishedDealSlug" | "listEquivalentPublishedDealSlugs">
    | Set<string>,
  slug: string,
) {
  if (store instanceof Set) {
    return store.has(slug) ? [slug] : [];
  }

  if (store.listEquivalentPublishedDealSlugs) {
    const equivalents = await store.listEquivalentPublishedDealSlugs(slug);
    return equivalents.length > 0 ? [...new Set(equivalents)] : [];
  }

  return (await store.hasPublishedDealSlug(slug)) ? [slug] : [];
}

export function createFavoritesRouter(
  sessionManager: SessionManager,
  publishedDealStore:
    | Pick<
        PublishedDealReader,
        "hasPublishedDealSlug" | "getCanonicalPublishedDealSlug" | "listEquivalentPublishedDealSlugs"
      >
    | Set<string>,
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
    const session = sessionManager.readSession(request.header("x-session-token") ?? undefined);

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const persistedFavorites = await store.listByEmail(session.email);
    const canonicalFavoriteMap = new Map<string, FavoriteRecord>();

    for (const favorite of persistedFavorites) {
      const canonicalDealId =
        (await getCanonicalPublishedDealSlug(publishedDealStore, favorite.dealId)) ?? favorite.dealId;

      if (!canonicalFavoriteMap.has(canonicalDealId)) {
        canonicalFavoriteMap.set(canonicalDealId, {
          dealId: canonicalDealId,
        });
      }
    }

    const favorites = [...canonicalFavoriteMap.values()].sort((left, right) => {
      return left.dealId.localeCompare(right.dealId);
    });

    response.json({
      items: favorites,
    });
  });

  router.post("/", async (request, response) => {
    const session = sessionManager.readSession(request.header("x-session-token") ?? undefined);

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

    const canonicalDealId = await getCanonicalPublishedDealSlug(publishedDealStore, input.dealId);

    if (!canonicalDealId) {
      response.status(400).json({ message: "Deal ID is invalid." });
      return;
    }

    await store.saveFavorite(session.email, canonicalDealId);

    response.status(201).json({ dealId: canonicalDealId });
  });

  router.delete("/:dealId", async (request, response) => {
    const session = sessionManager.readSession(request.header("x-session-token") ?? undefined);

    if (!session) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }

    const dealId = request.params.dealId;

    if (!isNonEmptyString(dealId)) {
      response.status(400).json({ message: "Deal ID is required." });
      return;
    }

    const equivalentDealIds = await listEquivalentPublishedDealSlugs(publishedDealStore, dealId);
    const dealIdsToDelete = equivalentDealIds.length > 0 ? equivalentDealIds : [dealId];

    for (const equivalentDealId of dealIdsToDelete) {
      await store.deleteFavorite(session.email, equivalentDealId);
    }

    response.status(204).send();
  });

  return router;
}
