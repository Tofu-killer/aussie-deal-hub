import { Prisma } from "@prisma/client";
import { prisma } from "../client.ts";

export interface SourceRecord {
  id: string;
  name: string;
  baseUrl: string;
  trustScore: number;
  language: string;
  enabled: boolean;
}

export async function listSources(): Promise<SourceRecord[]> {
  return prisma.source.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      trustScore: true,
      language: true,
      enabled: true,
    },
  });
}

export async function updateSourceEnabled(
  sourceId: string,
  enabled: boolean,
): Promise<SourceRecord | null> {
  try {
    return await prisma.source.update({
      where: {
        id: sourceId,
      },
      data: {
        enabled,
      },
      select: {
        id: true,
        name: true,
        baseUrl: true,
        trustScore: true,
        language: true,
        enabled: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }

    throw error;
  }
}
