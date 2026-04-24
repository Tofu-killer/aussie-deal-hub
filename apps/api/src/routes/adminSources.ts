import { Router } from "express";

import { prisma } from "@aussie-deal-hub/db/client";
import { listSources, updateSourceEnabled } from "@aussie-deal-hub/db/repositories/sources";

export interface SourceRecord {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
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
  setEnabled?(sourceId: string, enabled: boolean): Promise<SourceRecord | null>;
  create?(input: CreateSourceInput): Promise<SourceRecord>;
}

interface UpdateSourceEnabledInput {
  enabled: boolean;
}

interface CreateSourceInput {
  name: string;
  baseUrl: string;
  language: string;
  trustScore: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
    typeof input.trustScore === "number" &&
    Number.isInteger(input.trustScore)
  );
}

async function createSource(input: CreateSourceInput): Promise<SourceRecord> {
  const row = await prisma.source.create({
    data: {
      name: input.name.trim(),
      baseUrl: input.baseUrl.trim(),
      language: input.language.trim(),
      trustScore: input.trustScore,
      sourceType: "community",
      enabled: true,
    },
    select: {
      id: true,
      name: true,
      sourceType: true,
      baseUrl: true,
      trustScore: true,
      language: true,
      enabled: true,
      pollCount: true,
      lastPolledAt: true,
      lastPollStatus: true,
      lastPollMessage: true,
      lastLeadCreatedAt: true,
    },
  });

  return {
    ...row,
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    lastLeadCreatedAt: row.lastLeadCreatedAt?.toISOString() ?? null,
  };
}

function isUpdateSourceEnabledInput(value: unknown): value is UpdateSourceEnabledInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  return typeof (value as Record<string, unknown>).enabled === "boolean";
}

export function createAdminSourcesRouter(
  store: SourcesStore = {
    list: listSources,
    setEnabled: updateSourceEnabled,
  },
) {
  const router = Router();
  const sourceStore = {
    list: listSources,
    setEnabled: updateSourceEnabled,
    create: createSource,
    ...store,
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
    const input = request.body as UpdateSourceEnabledInput | undefined;

    if (!isUpdateSourceEnabledInput(input)) {
      response.status(400).json({ message: "Source payload is invalid." });
      return;
    }

    const source = await sourceStore.setEnabled(request.params.sourceId ?? "", input.enabled);

    if (!source) {
      response.status(404).json({ message: "Source not found." });
      return;
    }

    response.json(source);
  });

  return router;
}
