import { Prisma } from "@prisma/client";
import { prisma } from "../client.ts";

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

export async function listSources(): Promise<SourceRecord[]> {
  const rows = await prisma.source.findMany({
    orderBy: {
      name: "asc",
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

  return rows.map((row) => ({
    ...row,
    lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
    lastLeadCreatedAt: row.lastLeadCreatedAt?.toISOString() ?? null,
  }));
}

export async function updateSourceEnabled(
  sourceId: string,
  enabled: boolean,
): Promise<SourceRecord | null> {
  try {
    const row = await prisma.source.update({
      where: {
        id: sourceId,
      },
      data: {
        enabled,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
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
  trustScore: number;
  language: string;
}

export async function listEnabledSourcesForIngestion(): Promise<IngestibleSourceRecord[]> {
  return prisma.source.findMany({
    where: {
      enabled: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      sourceType: true,
      baseUrl: true,
      trustScore: true,
      language: true,
    },
  });
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
