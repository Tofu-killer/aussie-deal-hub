import { prisma } from "@aussie-deal-hub/db/client";
import { createPublishedDealRepository } from "@aussie-deal-hub/db/repositories/deals";
import { createAdminLeadRepository } from "@aussie-deal-hub/db/repositories/leads";

import { runWorkerCycle } from "./runtime";

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

let cycleInFlight = false;

async function executeWorkerPass() {
  if (cycleInFlight) {
    console.info(`[worker ${new Date().toISOString()}] skipping overlapping worker pass`);
    return;
  }

  cycleInFlight = true;

  try {
    await prisma.$connect();

    if (!reviewEnabled && !publishEnabled) {
      console.info(
        `[worker ${new Date().toISOString()}] worker pass skipped because review and publish are both disabled`,
      );
      return;
    }

    await runWorkerCycle({
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
  } catch (error) {
    console.error(`[worker ${new Date().toISOString()}] worker pass failed`, error);
  } finally {
    cycleInFlight = false;
  }
}

console.info(
  `[worker ${new Date().toISOString()}] starting with interval=${pollIntervalMs}ms review=${reviewEnabled} publish=${publishEnabled}`,
);

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
