import { Router } from "express";

export interface TopicCatalogRow {
  id: string;
  name: string;
  slug: string;
  spotlightDeals: number;
  status: string;
  owner: string;
}

export interface TopicsStore {
  listTopics(): Promise<TopicCatalogRow[]>;
  createTopic(input: { name: string }): Promise<TopicCatalogRow>;
}

const TOPIC_ROWS: TopicCatalogRow[] = [
  {
    id: "work-from-home",
    name: "Work From Home",
    slug: "work-from-home",
    spotlightDeals: 6,
    status: "Active",
    owner: "Discovery desk",
  },
  {
    id: "gaming-setup",
    name: "Gaming Setup",
    slug: "gaming-setup",
    spotlightDeals: 9,
    status: "Active",
    owner: "Discovery desk",
  },
  {
    id: "school-savings",
    name: "School Savings",
    slug: "school-savings",
    spotlightDeals: 4,
    status: "Seasonal",
    owner: "Everyday desk",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createUniqueId(name: string, existingIds: string[]) {
  const baseId = slugify(name) || "item";

  if (!existingIds.includes(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;

  while (existingIds.includes(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
}

function createInMemoryTopicsStore(): TopicsStore {
  const topicRows = TOPIC_ROWS.map((row) => ({ ...row }));

  return {
    async listTopics() {
      return topicRows;
    },
    async createTopic(input) {
      const id = createUniqueId(
        input.name,
        topicRows.map((row) => row.id),
      );
      const topic: TopicCatalogRow = {
        id,
        name: input.name,
        slug: id,
        spotlightDeals: 0,
        status: "Draft",
        owner: "Admin topics",
      };

      topicRows.unshift(topic);
      return topic;
    },
  };
}

export function createAdminTopicsRouter(store: TopicsStore = createInMemoryTopicsStore()) {
  const router = Router();

  router.get("/topics", async (_request, response) => {
    response.json({
      items: await store.listTopics(),
    });
  });

  router.post("/topics", async (request, response) => {
    const name = isRecord(request.body) ? readString(request.body.name).trim() : "";

    if (!name) {
      response.status(400).json({ message: "Name is required." });
      return;
    }

    response.status(201).json(await store.createTopic({ name }));
  });

  return router;
}
