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
  updateTopic(input: {
    id: string;
    name?: string;
    slug?: string;
    status?: string;
    owner?: string;
  }): Promise<TopicCatalogRow | null>;
  deleteTopic(id: string): Promise<boolean>;
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

function hasOwnProperty(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function readRequiredPatchString(
  body: Record<string, unknown>,
  key: string,
  label: string,
): { present: boolean; value?: string; error?: string } {
  if (!hasOwnProperty(body, key)) {
    return {
      present: false,
    };
  }

  const value = readString(body[key]).trim();

  if (!value) {
    return {
      present: true,
      error: `${label} is required.`,
    };
  }

  return {
    present: true,
    value,
  };
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
        topicRows.flatMap((row) => [row.id, row.slug]),
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
    async updateTopic(input) {
      const topic = topicRows.find((row) => row.id === input.id);

      if (!topic) {
        return null;
      }

      if (input.slug !== undefined) {
        const existing = topicRows.find((row) => row.slug === input.slug && row.id !== input.id);

        if (existing) {
          const error = new Error("Slug already exists.");
          error.name = "TopicConflictError";
          throw error;
        }
      }

      if (input.name !== undefined) {
        topic.name = input.name;
      }

      if (input.slug !== undefined) {
        topic.slug = input.slug;
      }

      if (input.status !== undefined) {
        topic.status = input.status;
      }

      if (input.owner !== undefined) {
        topic.owner = input.owner;
      }

      return topic;
    },
    async deleteTopic(id) {
      const topicIndex = topicRows.findIndex((row) => row.id === id);

      if (topicIndex < 0) {
        return false;
      }

      topicRows.splice(topicIndex, 1);
      return true;
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

  router.patch("/topics/:topicId", async (request, response) => {
    const body = isRecord(request.body) ? request.body : {};
    const name = readRequiredPatchString(body, "name", "Name");
    const slug = readRequiredPatchString(body, "slug", "Slug");
    const status = readRequiredPatchString(body, "status", "Status");
    const owner = readRequiredPatchString(body, "owner", "Owner");
    const errorMessage = name.error ?? slug.error ?? status.error ?? owner.error ?? null;

    if (errorMessage) {
      response.status(400).json({ message: errorMessage });
      return;
    }

    if (!name.present && !slug.present && !status.present && !owner.present) {
      response.status(400).json({ message: "At least one field is required." });
      return;
    }

    try {
      const topic = await store.updateTopic({
        id: request.params.topicId,
        name: name.value,
        slug: slug.value,
        status: status.value,
        owner: owner.value,
      });

      if (!topic) {
        response.status(404).json({ message: "Topic not found." });
        return;
      }

      response.json(topic);
    } catch (error) {
      if (error instanceof Error && error.name === "TopicConflictError") {
        response.status(409).json({ message: "Slug already exists." });
        return;
      }

      throw error;
    }
  });

  router.delete("/topics/:topicId", async (request, response) => {
    const deleted = await store.deleteTopic(request.params.topicId);

    if (!deleted) {
      response.status(404).json({ message: "Topic not found." });
      return;
    }

    response.status(204).end();
  });

  return router;
}
