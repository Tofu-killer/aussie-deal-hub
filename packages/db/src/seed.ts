import { pathToFileURL } from "node:url";
import { prisma } from "./client";
import { seedSelectedPriceSnapshots } from "./repositories/priceSnapshots.ts";

export async function seedCoreData() {
  await prisma.source.updateMany({
    where: {
      sourceType: "admin",
    },
    data: {
      enabled: false,
    },
  });

  const sources = [
    {
      name: "OzBargain",
      sourceType: "community",
      baseUrl: "https://www.ozbargain.com.au/deals",
      trustScore: 65,
      language: "en",
      enabled: true,
    },
    {
      name: "Choice Deals",
      sourceType: "publisher",
      baseUrl: "https://www.choice.com.au/",
      trustScore: 70,
      language: "en",
      enabled: false,
    },
    {
      name: "SMZDM",
      sourceType: "community",
      baseUrl: "https://www.smzdm.com",
      trustScore: 60,
      language: "zh",
      enabled: false,
    },
  ];

  for (const source of sources) {
    const existing = await prisma.source.findFirst({
      where: {
        OR: [
          {
            name: source.name,
          },
          {
            baseUrl: source.baseUrl,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      await prisma.source.update({
        where: {
          id: existing.id,
        },
        data: {
          baseUrl: source.baseUrl,
          enabled: source.enabled,
          language: source.language,
          trustScore: source.trustScore,
          name: source.name,
          sourceType: source.sourceType,
        },
      });
      continue;
    }

    await prisma.source.create({
      data: source,
    });
  }
}

async function main() {
  await seedCoreData();
  await seedSelectedPriceSnapshots();
}

const invokedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedAsScript) {
  main()
    .catch((error) => {
      console.error("Failed to seed core data", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
