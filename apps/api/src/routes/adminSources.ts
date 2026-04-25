import { Router } from "express";

import { prisma } from "@aussie-deal-hub/db/client";
import {
  getSourceById,
  getSourceForPolling,
  listSources,
  recordSourcePoll,
  updateSource,
} from "@aussie-deal-hub/db/repositories/sources";
import { createAdminLeadRepository } from "@aussie-deal-hub/db/repositories/leads";
import { extractLeadCandidates } from "../../../../packages/scraping/src/extractLeadCandidates.ts";
import { normalizeLead } from "../../../../packages/scraping/src/normalizeLead.ts";

const sourceFetchMethods = ["html", "json"] as const;

type SourceFetchMethod = (typeof sourceFetchMethods)[number];

const sourceRecordSelect = {
  id: true,
  name: true,
  sourceType: true,
  baseUrl: true,
  fetchMethod: true,
  pollIntervalMinutes: true,
  trustScore: true,
  language: true,
  enabled: true,
  pollCount: true,
  lastPolledAt: true,
  lastPollStatus: true,
  lastPollMessage: true,
  lastLeadCreatedAt: true,
} as const;

export interface SourceRecord {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
  fetchMethod: string;
  pollIntervalMinutes: number;
  trustScore: number;
  language: string;
  enabled: boolean;
  pollCount: number;
  lastPolledAt: string | null;
  lastPollStatus: string | null;
  lastPollMessage: string | null;
  lastLeadCreatedAt: string | null;
}

export interface SourcesStore {
  list?(): Promise<SourceRecord[]>;
  update?(
    sourceId: string,
    input: UpdateSourceInput,
  ): Promise<SourceRecord | null>;
  create?(input: CreateSourceInput): Promise<SourceRecord>;
  pollNow?(
    sourceId: string,
  ): Promise<{
    source: SourceRecord;
    createdLeadCount: number;
    status: "error" | "ok";
    message: string;
  } | null>;
}

interface CreateSourceInput {
  name: string;
  baseUrl: string;
  language: string;
  fetchMethod: SourceFetchMethod;
  pollIntervalMinutes: number;
  trustScore: number;
}

interface UpdateSourceInput {
  enabled?: boolean;
  fetchMethod?: SourceFetchMethod;
  pollIntervalMinutes?: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isSourceFetchMethod(value: unknown): value is SourceFetchMethod {
  return (
    typeof value === "string" &&
    sourceFetchMethods.includes(value as SourceFetchMethod)
  );
}

function isCreateSourceInput(value: unknown): value is CreateSourceInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    isNonEmptyString(input.name) &&
    isNonEmptyString(input.baseUrl) &&
    isNonEmptyString(input.language) &&
    isSourceFetchMethod(input.fetchMethod) &&
    isPositiveInteger(input.pollIntervalMinutes) &&
    typeof input.trustScore === "number" &&
    Number.isInteger(input.trustScore)
  );
}

function isUpdateSourceInput(value: unknown): value is UpdateSourceInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const input = value as Record<string, unknown>;
  const hasEnabled = Object.hasOwn(input, "enabled");
  const hasFetchMethod = Object.hasOwn(input, "fetchMethod");
  const hasPollIntervalMinutes = Object.hasOwn(input, "pollIntervalMinutes");

  if (!hasEnabled && !hasFetchMethod && !hasPollIntervalMinutes) {
    return false;
  }

  if (hasEnabled && typeof input.enabled !== "boolean") {
    return false;
  }

  if (hasFetchMethod && !isSourceFetchMethod(input.fetchMethod)) {
    return false;
  }

  if (hasPollIntervalMinutes && !isPositiveInteger(input.pollIntervalMinutes)) {
    return false;
  }

  return true;
}

function toSourceRecord(row: {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
  fetchMethod: string;
  pollIntervalMinutes: number;
  trustScore: number;
  language: string;
  enabled: boolean;
  pollCount: number;
  lastPolledAt: Date | null;
  lastPollStatus: string | null;
  lastPollMessage: string | null;
  lastLeadCreatedAt: Date | null;
}): SourceRecord {
  return {
    ...row,
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    lastLeadCreatedAt: row.lastLeadCreatedAt?.toISOString() ?? null,
  };
}

async function createSource(input: CreateSourceInput): Promise<SourceRecord> {
  const row = await prisma.source.create({
    data: {
      name: input.name.trim(),
      baseUrl: input.baseUrl.trim(),
      language: input.language.trim(),
      fetchMethod: input.fetchMethod,
      pollIntervalMinutes: input.pollIntervalMinutes,
      trustScore: input.trustScore,
      sourceType: "community",
      enabled: true,
    },
    select: sourceRecordSelect,
  });

  return toSourceRecord(row);
}

async function fetchSourceContent(source: { baseUrl: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(source.baseUrl, {
      headers: {
        "user-agent": "AussieDealHubAdmin/1.0 (+https://aussie-deal-hub.local)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Source fetch failed: ${response.status}`);
    }

    return {
      body: await response.text(),
      contentType: response.headers.get("content-type"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function pollSourceNow(sourceId: string) {
  const source = await getSourceForPolling(sourceId);

  if (!source) {
    return null;
  }

  const leadStore = createAdminLeadRepository();

  try {
    const fetched = await fetchSourceContent(source);
    const candidates = extractLeadCandidates({
      body: fetched.body,
      contentType: fetched.contentType,
      sourceName: source.name,
      sourceType: source.sourceType,
      sourceUrl: source.baseUrl,
    }).slice(0, 5);
    let createdLeadCount = 0;

    for (const candidate of candidates) {
      const normalized = normalizeLead(candidate);
        const result = await leadStore.createLeadIfNew({
          sourceId: source.id,
          originalTitle: candidate.title,
          originalUrl: candidate.url,
          canonicalUrl: normalized.canonicalUrl,
          snippet: candidate.snippet,
          merchant: normalized.merchant,
          localizedHints: normalized.localizedHints,
          sourceScore: source.trustScore,
          sourceSnapshot: JSON.stringify({
            source: {
              id: source.id,
              name: source.name,
              sourceType: source.sourceType,
              baseUrl: source.baseUrl,
              trustScore: source.trustScore,
            },
            candidate,
            normalized,
          }),
        });

      if (result.created) {
        createdLeadCount += 1;
      }
    }

    const message = `Fetched ${candidates.length} candidates; created ${createdLeadCount} leads.`;
    await recordSourcePoll({
      sourceId: source.id,
      createdLeadCount,
      message,
      status: "ok",
    });

    return {
      source: (await getSourceById(source.id))!,
      createdLeadCount,
      status: "ok" as const,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordSourcePoll({
      sourceId: source.id,
      createdLeadCount: 0,
      message,
      status: "error",
    });

    return {
      source: (await getSourceById(source.id))!,
      createdLeadCount: 0,
      status: "error" as const,
      message,
    };
  }
}

export function createAdminSourcesRouter(
  store: SourcesStore = {},
) {
  const router = Router();
  const sourceStore = {
    list: store.list ?? listSources,
    update: store.update ?? updateSource,
    create: store.create ?? createSource,
    pollNow: store.pollNow ?? pollSourceNow,
  };

  router.get("/", async (_request, response) => {
    response.json({
      items: await sourceStore.list(),
    });
  });

  router.post("/", async (request, response) => {
    const input = request.body as CreateSourceInput | undefined;

    if (!isCreateSourceInput(input)) {
      response.status(400).json({ message: "Source payload is invalid." });
      return;
    }

    const source = await sourceStore.create(input);
    response.status(201).json(source);
  });

  router.patch("/:sourceId", async (request, response) => {
    const input = request.body as UpdateSourceInput | undefined;

    if (!isUpdateSourceInput(input)) {
      response.status(400).json({ message: "Source payload is invalid." });
      return;
    }

    const source = await sourceStore.update(request.params.sourceId ?? "", input);

    if (!source) {
      response.status(404).json({ message: "Source not found." });
      return;
    }

    response.json(source);
  });

  router.post("/:sourceId/poll", async (request, response) => {
    const result = await sourceStore.pollNow(request.params.sourceId ?? "");

    if (!result) {
      response.status(404).json({ message: "Source not found." });
      return;
    }

    response.json(result);
  });

  return router;
}
