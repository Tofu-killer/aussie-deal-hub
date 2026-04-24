import { prisma } from "@aussie-deal-hub/db/client";
import { createPublishedDealRepository } from "@aussie-deal-hub/db/repositories/deals";
import { createAdminLeadRepository } from "@aussie-deal-hub/db/repositories/leads";

import { runWorkerCycle } from "./runtime";
import { writeWorkerState } from "./state";

function readPositiveIntegerEnv(name: string, fallbackValue: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallbackValue;
}

function isWorkerPassEnabled(name: string, fallbackValue = true) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallbackValue;
  }

  return rawValue !== "0" && rawValue.toLowerCase() !== "false";
}

const pollIntervalMs = readPositiveIntegerEnv("WORKER_POLL_INTERVAL_MS", 30000);
const reviewEnabled = isWorkerPassEnabled("WORKER_REVIEW_ENABLED", true);
const publishEnabled = isWorkerPassEnabled("WORKER_PUBLISH_ENABLED", true);
const leadStore = createAdminLeadRepository();
const publishedDealStore = createPublishedDealRepository();
const serviceStartedAt = new Date().toISOString();

let cycleInFlight = false;

async function executeWorkerPass() {
  if (cycleInFlight) {
    console.info(`[worker ${new Date().toISOString()}] skipping overlapping worker pass`);
    return;
  }

  cycleInFlight = true;
  const attemptedAt = new Date().toISOString();

  try {
    await prisma.$connect();

    if (!reviewEnabled && !publishEnabled) {
      await writeWorkerState({
        serviceStartedAt,
        status: "idle",
        lastAttemptedAt: attemptedAt,
        lastCompletedAt: attemptedAt,
        lastErrorAt: null,
        lastErrorMessage: null,
        lastSummary: null,
      });
      console.info(
        `[worker ${new Date().toISOString()}] worker pass skipped because review and publish are both disabled`,
      );
      return;
    }

    const summary = await runWorkerCycle({
      leadStore: reviewEnabled
        ? leadStore
        : {
            async listLeadRecords() {
              return (await leadStore.listLeadRecords()).filter((record) => record.review !== null);
            },
            saveLeadReviewDraft: leadStore.saveLeadReviewDraft,
          },
      publishedDealStore: publishEnabled
        ? publishedDealStore
        : {
            async hasPublishedDealSlug() {
              return false;
            },
            async getPublishedDealSlugForLead() {
              return null;
            },
            async publishDeal() {
              return {
                leadId: "",
                status: "disabled",
                locales: [],
              };
            },
      },
      log: console,
    });
    await writeWorkerState({
      serviceStartedAt,
      status: "ok",
      lastAttemptedAt: attemptedAt,
      lastCompletedAt: new Date().toISOString(),
      lastErrorAt: null,
      lastErrorMessage: null,
      lastSummary: summary,
    });
  } catch (error) {
    await writeWorkerState({
      serviceStartedAt,
      status: "error",
      lastAttemptedAt: attemptedAt,
      lastCompletedAt: null,
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: error instanceof Error ? error.message : String(error),
      lastSummary: null,
    });
    console.error(`[worker ${new Date().toISOString()}] worker pass failed`, error);
  } finally {
    cycleInFlight = false;
  }
}

console.info(
  `[worker ${new Date().toISOString()}] starting with interval=${pollIntervalMs}ms review=${reviewEnabled} publish=${publishEnabled}`,
);
await writeWorkerState({
  serviceStartedAt,
  status: "idle",
  lastAttemptedAt: null,
  lastCompletedAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  lastSummary: null,
});

void executeWorkerPass();
const intervalHandle = setInterval(() => {
  void executeWorkerPass();
}, pollIntervalMs);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    clearInterval(intervalHandle);
    await prisma.$disconnect();
    process.exit(0);
  });
}
