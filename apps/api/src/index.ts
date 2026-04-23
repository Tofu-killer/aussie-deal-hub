import { buildApp } from "./app.ts";
import { parseApiEnv } from "../../../packages/config/src/env.ts";
import { prisma } from "@aussie-deal-hub/db/client";
import { createDependencyHealthChecker } from "./routes/health.ts";
import net from "node:net";
import {
  getDigestSubscription,
  upsertDigestSubscription,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";
import { createPublishedDealRepository } from "@aussie-deal-hub/db/repositories/deals";
import { createAdminLeadRepository } from "@aussie-deal-hub/db/repositories/leads";
import { listPriceSnapshotsForDeal } from "@aussie-deal-hub/db/repositories/priceSnapshots";
import { listSources, updateSourceEnabled } from "@aussie-deal-hub/db/repositories/sources";

const {
  API_HOST: host,
  API_PORT: port,
  REDIS_URL: redisUrl,
} = parseApiEnv(process.env);
const adminLeadStore = createAdminLeadRepository();
const publishedDealStore = createPublishedDealRepository();

async function listPublishedDealPriceSnapshots(dealSlug: string) {
  try {
    return await listPriceSnapshotsForDeal(dealSlug);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Price snapshots are only supported for ")
    ) {
      return [];
    }

    throw error;
  }
}

async function checkRedisHealth() {
  const url = new URL(redisUrl);
  const port = Number.parseInt(url.port || "6379", 10);

  await new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({
      host: url.hostname,
      port,
    });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Redis health check timed out."));
    }, 1000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      socket.destroy();
      reject(error);
    });
  });
}

async function checkReadiness() {
  return createDependencyHealthChecker({
    db: async () => {
      await prisma.$queryRawUnsafe("SELECT 1");
    },
    dbSchema: async () => {
      await prisma.$transaction([
        prisma.source.findFirst({ select: { id: true } }),
        prisma.lead.findFirst({ select: { id: true } }),
        prisma.deal.findFirst({ select: { id: true } }),
        prisma.dealLocale.findFirst({ select: { id: true } }),
        prisma.leadReviewDraft.findFirst({ select: { id: true } }),
        prisma.leadReviewDraftLocale.findFirst({ select: { id: true } }),
        prisma.favorite.findFirst({
          select: {
            normalizedEmail: true,
            dealSlug: true,
          },
        }),
        prisma.emailDigestSubscription.findFirst({
          select: {
            normalizedEmail: true,
          },
        }),
        prisma.priceSnapshot.findFirst({ select: { id: true } }),
      ]);
    },
    redis: checkRedisHealth,
  })();
}

buildApp({
  adminLeadStore,
  digestPreferencesStore: {
    getByEmail: getDigestSubscription,
    upsertByEmail(email, input) {
      return upsertDigestSubscription({ email, ...input });
    },
  },
  publishedDealStore,
  priceSnapshotStore: {
    listSnapshotsForDeal: listPublishedDealPriceSnapshots,
  },
  readyCheck: checkReadiness,
  sourceStore: {
    list: listSources,
    setEnabled: updateSourceEnabled,
  },
}).listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
