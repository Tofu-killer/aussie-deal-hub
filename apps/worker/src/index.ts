import { prisma } from "@aussie-deal-hub/db/client";
import { createPublishedDealRepository } from "@aussie-deal-hub/db/repositories/deals";
import {
  listEligibleDigestSubscriptions,
  markDigestSent,
} from "@aussie-deal-hub/db/repositories/digestSubscriptions";
import { listFavoritesByEmail } from "@aussie-deal-hub/db/repositories/favorites";
import { createAdminLeadRepository } from "@aussie-deal-hub/db/repositories/leads";
import { listEnabledSourcesForIngestion, recordSourcePoll } from "@aussie-deal-hub/db/repositories/sources";
import {
  createLoggingEmailTransport,
  createSmtpEmailTransport,
  type EmailTransport,
} from "@aussie-deal-hub/email/verificationCodeSender";

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
const ingestEnabled = isWorkerPassEnabled("WORKER_INGEST_ENABLED", true);
const digestEnabled = isWorkerPassEnabled("WORKER_DIGEST_ENABLED", true);
const leadStore = createAdminLeadRepository();
const publishedDealStore = createPublishedDealRepository();
const serviceStartedAt = new Date().toISOString();

async function fetchSourceContent({ url }: { url: string; fetchMethod?: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "AussieDealHubWorker/1.0 (+https://aussie-deal-hub.local)",
      },
      signal: controller.signal,
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Source fetch failed: ${response.status}`);
    }

    return {
      body,
      contentType: response.headers.get("content-type"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function hasConfiguredSmtp() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

function createDigestEmailTransport(): EmailTransport {
  if (hasConfiguredSmtp()) {
    return createSmtpEmailTransport({
      host: process.env.SMTP_HOST!,
      port: readPositiveIntegerEnv("SMTP_PORT", 587),
      secure: process.env.SMTP_SECURE === "1" || process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SMTP configuration is required for digest delivery in production.");
  }

  return createLoggingEmailTransport();
}

function createDigestSender() {
  const transport = createDigestEmailTransport();
  const from = process.env.EMAIL_FROM ?? "deals@example.com";

  return {
    async sendDigest(input: {
      email: string;
      subject: string;
      html: string;
      deals: Array<{
        title: string;
      }>;
      locale: "en" | "zh";
    }) {
      await transport.send({
        from,
        to: input.email,
        subject: input.subject,
        html: input.html,
        text: input.deals.map((deal) => `- ${deal.title}`).join("\n"),
      });
    },
  };
}

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

    if (!ingestEnabled && !reviewEnabled && !publishEnabled && !digestEnabled) {
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
        `[worker ${new Date().toISOString()}] worker pass skipped because ingest, review, publish, and digest are all disabled`,
      );
      return;
    }

    const summary = await runWorkerCycle({
      leadStore: reviewEnabled
        ? leadStore
        : {
            async createLeadIfNew() {
              return { created: false };
            },
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
      sourceStore: ingestEnabled
        ? {
            listEnabledSources: listEnabledSourcesForIngestion,
            recordSourcePoll,
          }
        : {
            async listEnabledSources() {
              return [];
            },
            async recordSourcePoll() {
              return;
            },
          },
      sourceFetcher: {
        fetch: fetchSourceContent,
      },
      digestDelivery: digestEnabled
        ? {
            subscriptionStore: {
              listEligibleSubscriptions: listEligibleDigestSubscriptions,
              markSent: markDigestSent,
            },
            favoriteStore: {
              listByEmail: listFavoritesByEmail,
            },
            dealStore: {
              listDigestDeals: publishedDealStore.listPublishedDealsForDigest,
            },
            sender: createDigestSender(),
          }
        : undefined,
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
  `[worker ${new Date().toISOString()}] starting with interval=${pollIntervalMs}ms ingest=${ingestEnabled} review=${reviewEnabled} publish=${publishEnabled} digest=${digestEnabled}`,
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
