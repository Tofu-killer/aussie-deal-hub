import { Router } from "express";

import { prisma } from "@aussie-deal-hub/db/client";
import { listSources, updateSource } from "@aussie-deal-hub/db/repositories/sources";

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

export function createAdminSourcesRouter(
  store: SourcesStore = {},
) {
  const router = Router();
  const sourceStore = {
    list: store.list ?? listSources,
    update: store.update ?? updateSource,
    create: store.create ?? createSource,
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

  return router;
}
