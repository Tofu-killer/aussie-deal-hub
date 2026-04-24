import React from "react";

interface SummaryCardState {
  title: string;
  lines: string[];
  error: string | null;
}

interface DashboardSummaryState {
  leads: SummaryCardState;
  sources: SummaryCardState;
  publishing: SummaryCardState;
  worker: SummaryCardState;
}

interface LoadSummaryResult {
  body: unknown;
  error: string | null;
}

type LeadQueueStatus =
  | "pending_review"
  | "draft_saved"
  | "queued_to_publish"
  | "published";

function getAdminApiBaseUrl() {
  return process.env.ADMIN_API_BASE_URL ?? "http://127.0.0.1:3001";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function extractItems(body: unknown, alternateKey?: string) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!isRecord(body)) {
    return [];
  }

  if (Array.isArray(body.items)) {
    return body.items;
  }

  if (alternateKey && Array.isArray(body[alternateKey])) {
    return body[alternateKey];
  }

  return [];
}

function createErrorCard(title: string, error: string): SummaryCardState {
  return {
    title,
    lines: [],
    error,
  };
}

function isLeadQueueStatus(value: string): value is LeadQueueStatus {
  return (
    value === "pending_review" ||
    value === "draft_saved" ||
    value === "queued_to_publish" ||
    value === "published"
  );
}

function readLeadQueueStatus(item: unknown): LeadQueueStatus {
  if (!isRecord(item)) {
    return "pending_review";
  }

  if (isRecord(item.queue)) {
    const queueStatus = readString(item.queue.status);

    if (isLeadQueueStatus(queueStatus)) {
      return queueStatus;
    }
  }

  if (isRecord(item.review)) {
    return readBoolean(item.review.publish) ? "queued_to_publish" : "draft_saved";
  }

  return "pending_review";
}

function formatLeadQueueStatusLine(status: LeadQueueStatus, count: number) {
  switch (status) {
    case "draft_saved":
      return `${count} ${count === 1 ? "draft saved" : "drafts saved"}`;
    case "published":
      return `${count} published`;
    case "queued_to_publish":
      return `${count} queued to publish`;
    default:
      return `${count} pending ${count === 1 ? "review" : "reviews"}`;
  }
}

function summarizeLeadQueue(result: LoadSummaryResult): SummaryCardState {
  if (result.error) {
    return createErrorCard("Lead queue", result.error);
  }

  let total = 0;
  const statusCounts = new Map<LeadQueueStatus, number>();

  extractItems(result.body, "leads").forEach((item) => {
    if (!isRecord(item) || !readString(item.id)) {
      return;
    }

    total += 1;
    const status = readLeadQueueStatus(item);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  });

  const lines = [`${total} ${total === 1 ? "lead" : "leads"} in queue`];
  const statusOrder: LeadQueueStatus[] = [
    "pending_review",
    "draft_saved",
    "queued_to_publish",
    "published",
  ];

  statusOrder.forEach((status) => {
    const count = statusCounts.get(status) ?? 0;

    if (count > 0) {
      lines.push(formatLeadQueueStatusLine(status, count));
    }
  });

  return {
    title: "Lead queue",
    lines,
    error: null,
  };
}

function summarizeSources(result: LoadSummaryResult): SummaryCardState {
  if (result.error) {
    return createErrorCard("Sources", result.error);
  }

  let total = 0;
  let enabledCount = 0;

  extractItems(result.body).forEach((item) => {
    if (!isRecord(item) || !readString(item.id)) {
      return;
    }

    total += 1;

    if (readBoolean(item.enabled)) {
      enabledCount += 1;
    }
  });

  return {
    title: "Sources",
    lines: [
      `${total} ${total === 1 ? "source" : "sources"} tracked`,
      `${enabledCount} enabled`,
      `${Math.max(total - enabledCount, 0)} disabled`,
    ],
    error: null,
  };
}

function summarizePublishingQueue(result: LoadSummaryResult): SummaryCardState {
  if (result.error) {
    return createErrorCard("Publishing queue", result.error);
  }

  const statusCounts = new Map<string, number>();
  let total = 0;

  extractItems(result.body, "queue").forEach((item) => {
    if (!isRecord(item) || !readString(item.id)) {
      return;
    }

    total += 1;

    const status = readString(item.status);

    if (status) {
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }
  });

  const statusOrder = ["scheduled", "ready", "blocked"];
  const statusLines = Array.from(statusCounts.entries())
    .sort((left, right) => {
      const leftOrder = statusOrder.indexOf(left[0]);
      const rightOrder = statusOrder.indexOf(right[0]);

      if (leftOrder === -1 && rightOrder === -1) {
        return left[0].localeCompare(right[0]);
      }

      if (leftOrder === -1) {
        return 1;
      }

      if (rightOrder === -1) {
        return -1;
      }

      return leftOrder - rightOrder;
    })
    .map(([status, count]) => `${count} ${status}`);

  return {
    title: "Publishing queue",
    lines: [`${total} publishing ${total === 1 ? "job" : "jobs"}`, ...statusLines],
    error: null,
  };
}

function summarizeWorkerRuntime(result: LoadSummaryResult): SummaryCardState {
  if (result.error) {
    return createErrorCard("Worker", result.error);
  }

  if (!isRecord(result.body)) {
    return createErrorCard("Worker", "Failed to load worker runtime.");
  }

  const status = readString(result.body.status) || "unknown";
  const lastSummary = isRecord(result.body.lastSummary) ? result.body.lastSummary : {};
  const ageMs = typeof result.body.ageMs === "number" ? result.body.ageMs : null;
  const lastErrorMessage = readString(result.body.lastErrorMessage);

  if (status === "error") {
    return createErrorCard("Worker", lastErrorMessage || "Worker runtime error.");
  }

  if (status === "stale") {
    return createErrorCard("Worker", "Worker heartbeat is stale.");
  }

  const reviewedCount = typeof lastSummary.reviewedCount === "number" ? lastSummary.reviewedCount : 0;
  const publishedCount =
    typeof lastSummary.publishedCount === "number" ? lastSummary.publishedCount : 0;

  return {
    title: "Worker",
    lines: [
      "Healthy",
      `${reviewedCount} reviewed last pass`,
      `${publishedCount} published last pass`,
      ageMs === null ? "Heartbeat age unavailable" : `${Math.floor(ageMs / 1000)}s since heartbeat`,
    ],
    error: null,
  };
}

async function loadSummary(path: string, error: string): Promise<LoadSummaryResult> {
  try {
    const response = await fetch(`${getAdminApiBaseUrl()}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        body: null,
        error,
      };
    }

    return {
      body: await response.json(),
      error: null,
    };
  } catch {
    return {
      body: null,
      error,
    };
  }
}

async function loadDashboardSummary(): Promise<DashboardSummaryState> {
  const [leads, sources, publishing, worker] = await Promise.all([
    loadSummary("/v1/admin/leads", "Failed to load lead queue."),
    loadSummary("/v1/admin/sources", "Failed to load sources."),
    loadSummary("/v1/admin/publishing", "Failed to load publishing queue."),
    loadSummary("/v1/admin/runtime/worker", "Failed to load worker runtime."),
  ]);

  return {
    leads: summarizeLeadQueue(leads),
    sources: summarizeSources(sources),
    publishing: summarizePublishingQueue(publishing),
    worker: summarizeWorkerRuntime(worker),
  };
}

export default async function AdminHomePage() {
  const summary = await loadDashboardSummary();

  return (
    <main className="admin-home">
      <section className="admin-home__hero">
        <div>
          <p className="admin-kicker">Operational overview</p>
          <h1>Admin review dashboard</h1>
          <p>Review incoming leads and prepare them for publication.</p>
        </div>
        <p className="admin-home__note">
          Keep intake, review, and publishing inside one protected workspace.
        </p>
      </section>
      <section aria-labelledby="live-summary-heading" className="admin-panel">
        <h2 id="live-summary-heading">Live summary</h2>
        <ul className="admin-summary-grid">
          {Object.values(summary).map((card) => (
            <li key={card.title} className="admin-summary-card">
              <h3>{card.title}</h3>
              {card.error
                ? (
                    <p>{card.error}</p>
                  )
                : (
                    card.lines.map((line) => <p key={line}>{line}</p>)
                  )}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="workflow-shortcuts-heading" className="admin-panel">
        <div className="admin-panel__header">
          <h2 id="workflow-shortcuts-heading">Workflow shortcuts</h2>
          <p>Jump directly into the queue, preview tools, or publishing catalog.</p>
        </div>
        <ul className="admin-action-grid">
        <li>
          <a href="/leads">Open lead queue</a>
        </li>
        <li>
          <a href="/publishing">Review publishing queue</a>
        </li>
        <li>
          <a href="/intake">Preview intake</a>
        </li>
        <li>
          <a href="/digest">Preview digest</a>
        </li>
        <li>
          <a href="/sources">Manage sources</a>
        </li>
        <li>
          <a href="/merchants">Manage merchants</a>
        </li>
        <li>
          <a href="/tags">Manage tags</a>
        </li>
        </ul>
      </section>
    </main>
  );
}
