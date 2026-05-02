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

export interface AdminCatalogStore {
  listMerchants(): Promise<MerchantCatalogRow[]>;
  createMerchant(input: { name: string }): Promise<MerchantCatalogRow>;
  updateMerchant(input: {
    id: string;
    name?: string;
    primaryCategory?: string;
    status?: string;
    owner?: string;
  }): Promise<MerchantCatalogRow | null>;
  deleteMerchant(id: string): Promise<boolean>;
  listTags(): Promise<TagCatalogRow[]>;
  createTag(input: { name: string }): Promise<TagCatalogRow>;
  updateTag(input: {
    id: string;
    name?: string;
    slug?: string;
    localization?: string;
    owner?: string;
  }): Promise<TagCatalogRow | null>;
  deleteTag(id: string): Promise<boolean>;
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
    async updateMerchant(input) {
      const merchant = merchantRows.find((row) => row.id === input.id);

      if (!merchant) {
        return null;
      }

      if (input.name !== undefined) {
        merchant.name = input.name;
      }

      if (input.primaryCategory !== undefined) {
        merchant.primaryCategory = input.primaryCategory;
      }

      if (input.status !== undefined) {
        merchant.status = input.status;
      }

      if (input.owner !== undefined) {
        merchant.owner = input.owner;
      }

      return merchant;
    },
    async deleteMerchant(id) {
      const merchantIndex = merchantRows.findIndex((row) => row.id === id);

      if (merchantIndex < 0) {
        return false;
      }

      merchantRows.splice(merchantIndex, 1);
      return true;
    },
    async listTags() {
      return tagRows;
    },
    async createTag(input) {
      const id = createUniqueId(
        input.name,
        tagRows.flatMap((row) => [row.id, row.slug]),
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
    async updateTag(input) {
      const tag = tagRows.find((row) => row.id === input.id);

      if (!tag) {
        return null;
      }

      if (input.slug !== undefined) {
        const existing = tagRows.find((row) => row.slug === input.slug && row.id !== input.id);

        if (existing) {
          const error = new Error("Slug already exists.");
          error.name = "CatalogConflictError";
          throw error;
        }
      }

      if (input.name !== undefined) {
        tag.name = input.name;
      }

      if (input.slug !== undefined) {
        tag.slug = input.slug;
      }

      if (input.localization !== undefined) {
        tag.localization = input.localization;
      }

      if (input.owner !== undefined) {
        tag.owner = input.owner;
      }

      return tag;
    },
    async deleteTag(id) {
      const tagIndex = tagRows.findIndex((row) => row.id === id);

      if (tagIndex < 0) {
        return false;
      }

      tagRows.splice(tagIndex, 1);
      return true;
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

  router.patch("/merchants/:merchantId", async (request, response) => {
    const body = isRecord(request.body) ? request.body : {};
    const name = readRequiredPatchString(body, "name", "Name");
    const primaryCategory = readRequiredPatchString(body, "primaryCategory", "Primary category");
    const status = readRequiredPatchString(body, "status", "Status");
    const owner = readRequiredPatchString(body, "owner", "Owner");
    const errorMessage =
      name.error ?? primaryCategory.error ?? status.error ?? owner.error ?? null;

    if (errorMessage) {
      response.status(400).json({ message: errorMessage });
      return;
    }

    if (!name.present && !primaryCategory.present && !status.present && !owner.present) {
      response.status(400).json({ message: "At least one field is required." });
      return;
    }

    const merchant = await store.updateMerchant({
      id: request.params.merchantId,
      name: name.value,
      primaryCategory: primaryCategory.value,
      status: status.value,
      owner: owner.value,
    });

    if (!merchant) {
      response.status(404).json({ message: "Merchant not found." });
      return;
    }

    response.json(merchant);
  });

  router.delete("/merchants/:merchantId", async (request, response) => {
    const deleted = await store.deleteMerchant(request.params.merchantId);

    if (!deleted) {
      response.status(404).json({ message: "Merchant not found." });
      return;
    }

    response.status(204).end();
  });

  router.patch("/tags/:tagId", async (request, response) => {
    const body = isRecord(request.body) ? request.body : {};
    const name = readRequiredPatchString(body, "name", "Name");
    const slug = readRequiredPatchString(body, "slug", "Slug");
    const localization = readRequiredPatchString(body, "localization", "Localization");
    const owner = readRequiredPatchString(body, "owner", "Owner");
    const errorMessage = name.error ?? slug.error ?? localization.error ?? owner.error ?? null;

    if (errorMessage) {
      response.status(400).json({ message: errorMessage });
      return;
    }

    if (!name.present && !slug.present && !localization.present && !owner.present) {
      response.status(400).json({ message: "At least one field is required." });
      return;
    }

    try {
      const tag = await store.updateTag({
        id: request.params.tagId,
        name: name.value,
        slug: slug.value,
        localization: localization.value,
        owner: owner.value,
      });

      if (!tag) {
        response.status(404).json({ message: "Tag not found." });
        return;
      }

      response.json(tag);
    } catch (error) {
      if (error instanceof Error && error.name === "CatalogConflictError") {
        response.status(409).json({ message: "Slug already exists." });
        return;
      }

      throw error;
    }
  });

  router.delete("/tags/:tagId", async (request, response) => {
    const deleted = await store.deleteTag(request.params.tagId);

    if (!deleted) {
      response.status(404).json({ message: "Tag not found." });
      return;
    }

    response.status(204).end();
  });

  return router;
}
