import { Router } from "express";

export interface MerchantCatalogRow {
  id: string;
  name: string;
  activeDeals: number;
  primaryCategory: string;
  status: string;
  owner: string;
}

export interface TagCatalogRow {
  id: string;
  name: string;
  slug: string;
  visibleDeals: number;
  localization: string;
  owner: string;
}

const MERCHANT_CATALOG_ROWS: MerchantCatalogRow[] = [
  {
    id: "amazon-au",
    name: "Amazon AU",
    activeDeals: 42,
    primaryCategory: "Electronics",
    status: "Active",
    owner: "Marketplace desk",
  },
  {
    id: "chemist-warehouse",
    name: "Chemist Warehouse",
    activeDeals: 17,
    primaryCategory: "Health",
    status: "Needs review",
    owner: "Retail desk",
  },
  {
    id: "the-iconic",
    name: "The Iconic",
    activeDeals: 9,
    primaryCategory: "Fashion",
    status: "Active",
    owner: "Lifestyle desk",
  },
];

const TAG_CATALOG_ROWS: TagCatalogRow[] = [
  {
    id: "gaming",
    name: "Gaming",
    slug: "gaming",
    visibleDeals: 18,
    localization: "EN + ZH ready",
    owner: "Discovery desk",
  },
  {
    id: "grocery",
    name: "Grocery",
    slug: "grocery",
    visibleDeals: 25,
    localization: "EN + ZH ready",
    owner: "Everyday desk",
  },
  {
    id: "travel",
    name: "Travel",
    slug: "travel",
    visibleDeals: 7,
    localization: "Needs ZH review",
    owner: "Lifestyle desk",
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

export interface AdminCatalogStore {
  listMerchants(): Promise<MerchantCatalogRow[]>;
  createMerchant(input: { name: string }): Promise<MerchantCatalogRow>;
  listTags(): Promise<TagCatalogRow[]>;
  createTag(input: { name: string }): Promise<TagCatalogRow>;
}

function createInMemoryAdminCatalogStore(): AdminCatalogStore {
  const merchantRows = MERCHANT_CATALOG_ROWS.map((row) => ({ ...row }));
  const tagRows = TAG_CATALOG_ROWS.map((row) => ({ ...row }));

  return {
    async listMerchants() {
      return merchantRows;
    },
    async createMerchant(input) {
      const merchant: MerchantCatalogRow = {
        id: createUniqueId(
          input.name,
          merchantRows.map((row) => row.id),
        ),
        name: input.name,
        activeDeals: 0,
        primaryCategory: "Unassigned",
        status: "Draft",
        owner: "Admin catalog",
      };

      merchantRows.unshift(merchant);
      return merchant;
    },
    async listTags() {
      return tagRows;
    },
    async createTag(input) {
      const id = createUniqueId(
        input.name,
        tagRows.map((row) => row.id),
      );
      const tag: TagCatalogRow = {
        id,
        name: input.name,
        slug: id,
        visibleDeals: 0,
        localization: "Needs localization",
        owner: "Admin catalog",
      };

      tagRows.unshift(tag);
      return tag;
    },
  };
}

export function createAdminCatalogRouter(store: AdminCatalogStore = createInMemoryAdminCatalogStore()) {
  const router = Router();

  router.get("/merchants", async (_request, response) => {
    response.json({
      items: await store.listMerchants(),
    });
  });

  router.get("/tags", async (_request, response) => {
    response.json({
      items: await store.listTags(),
    });
  });

  router.post("/merchants", async (request, response) => {
    const name = isRecord(request.body) ? readString(request.body.name).trim() : "";

    if (!name) {
      response.status(400).json({ message: "Name is required." });
      return;
    }

    const merchant = await store.createMerchant({ name });
    response.status(201).json(merchant);
  });

  router.post("/tags", async (request, response) => {
    const name = isRecord(request.body) ? readString(request.body.name).trim() : "";

    if (!name) {
      response.status(400).json({ message: "Name is required." });
      return;
    }

    const tag = await store.createTag({ name });
    response.status(201).json(tag);
  });

  return router;
}
