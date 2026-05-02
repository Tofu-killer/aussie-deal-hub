import { Prisma } from "@prisma/client";
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

export interface TopicCatalogRecord {
  id: string;
  name: string;
  slug: string;
  spotlightDeals: number;
  status: string;
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

const seededTopics: TopicCatalogRecord[] = [
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

const merchantCatalogSelect = {
  id: true,
  name: true,
  activeDeals: true,
  primaryCategory: true,
  status: true,
  owner: true,
} satisfies Prisma.MerchantCatalogSelect;

const tagCatalogSelect = {
  id: true,
  name: true,
  slug: true,
  visibleDeals: true,
  localization: true,
  owner: true,
} satisfies Prisma.TagCatalogSelect;

const topicCatalogSelect = {
  id: true,
  name: true,
  slug: true,
  spotlightDeals: true,
  status: true,
  owner: true,
} satisfies Prisma.TopicCatalogSelect;

function createConflictError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
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

export async function seedAdminCatalog() {
  await prisma.merchantCatalog.createMany({
    data: seededMerchants,
    skipDuplicates: true,
  });

  await prisma.tagCatalog.createMany({
    data: seededTags,
    skipDuplicates: true,
  });

  await prisma.topicCatalog.createMany({
    data: seededTopics,
    skipDuplicates: true,
  });
}

export function createAdminCatalogRepository() {
  return {
    async listMerchants(): Promise<MerchantCatalogRecord[]> {
      return prisma.merchantCatalog.findMany({
        orderBy: {
          name: "asc",
        },
        select: merchantCatalogSelect,
      });
    },
    async createMerchant(input: {
      name: string;
    }): Promise<MerchantCatalogRecord> {
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
        select: merchantCatalogSelect,
      });
    },
    async updateMerchant(input: {
      id: string;
      name?: string;
      primaryCategory?: string;
      status?: string;
      owner?: string;
    }): Promise<MerchantCatalogRecord | null> {
      try {
        return await prisma.merchantCatalog.update({
          where: {
            id: input.id,
          },
          data: {
            name: input.name,
            primaryCategory: input.primaryCategory,
            status: input.status,
            owner: input.owner,
          },
          select: merchantCatalogSelect,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    },
    async deleteMerchant(id: string): Promise<boolean> {
      try {
        await prisma.merchantCatalog.delete({
          where: {
            id,
          },
        });
        return true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return false;
        }

        throw error;
      }
    },
    async listTags(): Promise<TagCatalogRecord[]> {
      return prisma.tagCatalog.findMany({
        orderBy: {
          name: "asc",
        },
        select: tagCatalogSelect,
      });
    },
    async createTag(input: {
      name: string;
    }): Promise<TagCatalogRecord> {
      const existingIds = (
        await prisma.tagCatalog.findMany({
          select: {
            id: true,
            slug: true,
          },
        })
      ).flatMap((row) => [row.id, row.slug]);
      const id = createUniqueId(input.name, existingIds);

      return prisma.tagCatalog.create({
        data: {
          id,
          name: input.name,
          slug: id,
        },
        select: tagCatalogSelect,
      });
    },
    async updateTag(input: {
      id: string;
      name?: string;
      slug?: string;
      localization?: string;
      owner?: string;
    }): Promise<TagCatalogRecord | null> {
      if (input.slug) {
        const existing = await prisma.tagCatalog.findUnique({
          where: {
            slug: input.slug,
          },
          select: {
            id: true,
          },
        });

        if (existing && existing.id !== input.id) {
          throw createConflictError("CatalogConflictError", "Slug already exists.");
        }
      }

      try {
        return await prisma.tagCatalog.update({
          where: {
            id: input.id,
          },
          data: {
            name: input.name,
            slug: input.slug,
            localization: input.localization,
            owner: input.owner,
          },
          select: tagCatalogSelect,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    },
    async deleteTag(id: string): Promise<boolean> {
      try {
        await prisma.tagCatalog.delete({
          where: {
            id,
          },
        });
        return true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return false;
        }

        throw error;
      }
    },
    async listTopics(): Promise<TopicCatalogRecord[]> {
      return prisma.topicCatalog.findMany({
        orderBy: {
          name: "asc",
        },
        select: topicCatalogSelect,
      });
    },
    async createTopic(input: {
      name: string;
    }): Promise<TopicCatalogRecord> {
      const existingIds = (
        await prisma.topicCatalog.findMany({
          select: {
            id: true,
            slug: true,
          },
        })
      ).flatMap((row) => [row.id, row.slug]);
      const id = createUniqueId(input.name, existingIds);

      return prisma.topicCatalog.create({
        data: {
          id,
          name: input.name,
          slug: id,
        },
        select: topicCatalogSelect,
      });
    },
    async updateTopic(input: {
      id: string;
      name?: string;
      slug?: string;
      status?: string;
      owner?: string;
    }): Promise<TopicCatalogRecord | null> {
      if (input.slug) {
        const existing = await prisma.topicCatalog.findUnique({
          where: {
            slug: input.slug,
          },
          select: {
            id: true,
          },
        });

        if (existing && existing.id !== input.id) {
          throw createConflictError("TopicConflictError", "Slug already exists.");
        }
      }

      try {
        return await prisma.topicCatalog.update({
          where: {
            id: input.id,
          },
          data: {
            name: input.name,
            slug: input.slug,
            status: input.status,
            owner: input.owner,
          },
          select: topicCatalogSelect,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return null;
        }

        throw error;
      }
    },
    async deleteTopic(id: string): Promise<boolean> {
      try {
        await prisma.topicCatalog.delete({
          where: {
            id,
          },
        });
        return true;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
          return false;
        }

        throw error;
      }
    },
  };
}
