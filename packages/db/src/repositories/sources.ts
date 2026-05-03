import { Prisma } from "@prisma/client";
import { prisma } from "../client.ts";

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
} satisfies Prisma.SourceSelect;

type SourceRow = Prisma.SourceGetPayload<{
  select: typeof sourceRecordSelect;
}>;

const sourceNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function toSourceRecord(row: SourceRow): SourceRecord {
  return {
    ...row,
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    lastLeadCreatedAt: row.lastLeadCreatedAt?.toISOString() ?? null,
  };
}

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

export async function listSources(): Promise<SourceRecord[]> {
  const rows = await prisma.source.findMany({
    orderBy: {
      name: "asc",
    },
    select: sourceRecordSelect,
  });

  return rows
    .sort((left, right) => sourceNameCollator.compare(left.name, right.name))
    .map(toSourceRecord);
}

export async function getSourceById(sourceId: string): Promise<SourceRecord | null> {
  const row = await prisma.source.findUnique({
    where: {
      id: sourceId,
    },
    select: sourceRecordSelect,
  });

  return row ? toSourceRecord(row) : null;
}

export interface UpdateSourceInput {
  enabled?: boolean;
  fetchMethod?: string;
  pollIntervalMinutes?: number;
}

export async function updateSource(
  sourceId: string,
  input: UpdateSourceInput,
): Promise<SourceRecord | null> {
  try {
    const row = await prisma.source.update({
      where: {
        id: sourceId,
      },
      data: {
        enabled: input.enabled,
        fetchMethod: input.fetchMethod,
        pollIntervalMinutes: input.pollIntervalMinutes,
      },
      select: sourceRecordSelect,
    });

    return toSourceRecord(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }

    throw error;
  }
}

export async function deleteSource(sourceId: string): Promise<boolean> {
  try {
    await prisma.source.delete({
      where: {
        id: sourceId,
      },
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return false;
    }

    throw error;
  }
}

export interface SourcePollUpdateInput {
  sourceId: string;
  createdLeadCount: number;
  message: string;
  status: "error" | "ok";
}

export interface IngestibleSourceRecord {
  id: string;
  name: string;
  sourceType: string;
  baseUrl: string;
  fetchMethod: string;
  pollIntervalMinutes: number;
  trustScore: number;
  language: string;
  lastPolledAt: string | null;
}

export async function listEnabledSourcesForIngestion(): Promise<IngestibleSourceRecord[]> {
  const rows = await prisma.source.findMany({
    where: {
      enabled: true,
      sourceType: {
        not: "admin",
      },
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      sourceType: true,
      baseUrl: true,
      fetchMethod: true,
      pollIntervalMinutes: true,
      trustScore: true,
      language: true,
      lastPolledAt: true,
    },
  });

  return rows
    .sort((left, right) => sourceNameCollator.compare(left.name, right.name))
    .map((row) => ({
      ...row,
      lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    }));
}

export async function recordSourcePoll(input: SourcePollUpdateInput): Promise<void> {
  await prisma.source.update({
    where: {
      id: input.sourceId,
    },
    data: {
      pollCount: {
        increment: 1,
      },
      lastPolledAt: new Date(),
      lastPollStatus: input.status,
      lastPollMessage: input.message,
      lastLeadCreatedAt: input.createdLeadCount > 0 ? new Date() : undefined,
    },
  });
}

export async function getSourceForPolling(sourceId: string): Promise<IngestibleSourceRecord | null> {
  const row = await prisma.source.findUnique({
    where: {
      id: sourceId,
    },
    select: {
      id: true,
      name: true,
      sourceType: true,
      baseUrl: true,
      fetchMethod: true,
      pollIntervalMinutes: true,
      trustScore: true,
      language: true,
      lastPolledAt: true,
    },
  });

  if (!row) {
    return null;
  }

  return {
    ...row,
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
  };
}
