import { pathToFileURL } from "node:url";
import { prisma } from "./client";
import { seedSelectedPriceSnapshots } from "./repositories/priceSnapshots.ts";

export async function seedCoreData() {
  const sources = [
    {
      name: "OzBargain",
      sourceType: "community",
      baseUrl: "https://www.ozbargain.com.au",
      trustScore: 65,
      language: "en",
      enabled: true,
    },
    {
      name: "Choice Deals",
      sourceType: "publisher",
      baseUrl: "https://www.choice.com.au/shopping/deals",
      trustScore: 70,
      language: "en",
      enabled: true,
    },
    {
      name: "SMZDM",
      sourceType: "community",
      baseUrl: "https://www.smzdm.com",
      trustScore: 60,
      language: "zh",
      enabled: true,
    },
  ];

  for (const source of sources) {
    await prisma.source.upsert({
      where: {
        baseUrl: source.baseUrl,
      },
      update: {
        enabled: source.enabled,
        language: source.language,
        trustScore: source.trustScore,
        name: source.name,
        sourceType: source.sourceType,
      },
      create: source,
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
