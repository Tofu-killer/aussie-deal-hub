import { prisma } from "../client.ts";

export interface MerchantCatalogRecord {
  id: string;
  name: string;
  activeDeals: number;
  primaryCategory: string;
  status: string;
  owner: string;
}

export interface TagCatalogRecord {
  id: string;
  name: string;
  slug: string;
  visibleDeals: number;
  localization: string;
  owner: string;
}

const seededMerchants: MerchantCatalogRecord[] = [
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

const seededTags: TagCatalogRecord[] = [
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

export async function seedAdminCatalog() {
  const merchantCount = await prisma.merchantCatalog.count();

  if (merchantCount === 0) {
    await prisma.merchantCatalog.createMany({
      data: seededMerchants,
    });
  }

  const tagCount = await prisma.tagCatalog.count();

  if (tagCount === 0) {
    await prisma.tagCatalog.createMany({
      data: seededTags,
    });
  }
}

export function createAdminCatalogRepository() {
  return {
    async listMerchants(): Promise<MerchantCatalogRecord[]> {
      await seedAdminCatalog();

      return prisma.merchantCatalog.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          activeDeals: true,
          primaryCategory: true,
          status: true,
          owner: true,
        },
      });
    },
    async createMerchant(input: {
      name: string;
    }): Promise<MerchantCatalogRecord> {
      await seedAdminCatalog();
      const existingIds = (
        await prisma.merchantCatalog.findMany({
          select: {
            id: true,
          },
        })
      ).map((row) => row.id);
      const id = createUniqueId(input.name, existingIds);

      return prisma.merchantCatalog.create({
        data: {
          id,
          name: input.name,
        },
        select: {
          id: true,
          name: true,
          activeDeals: true,
          primaryCategory: true,
          status: true,
          owner: true,
        },
      });
    },
    async listTags(): Promise<TagCatalogRecord[]> {
      await seedAdminCatalog();

      return prisma.tagCatalog.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          slug: true,
          visibleDeals: true,
          localization: true,
          owner: true,
        },
      });
    },
    async createTag(input: {
      name: string;
    }): Promise<TagCatalogRecord> {
      await seedAdminCatalog();
      const existingIds = (
        await prisma.tagCatalog.findMany({
          select: {
            id: true,
          },
        })
      ).map((row) => row.id);
      const id = createUniqueId(input.name, existingIds);

      return prisma.tagCatalog.create({
        data: {
          id,
          name: input.name,
          slug: id,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          visibleDeals: true,
          localization: true,
          owner: true,
        },
      });
    },
  };
}
