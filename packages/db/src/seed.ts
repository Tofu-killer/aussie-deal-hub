import { pathToFileURL } from "node:url";
import { prisma } from "./client";
import { seedSelectedPriceSnapshots } from "./repositories/priceSnapshots.ts";

export async function seedCoreData() {
  await prisma.source.upsert({
    where: {
      baseUrl: "https://www.ozbargain.com.au",
    },
    update: {
      enabled: true,
      language: "en",
      trustScore: 65,
    },
    create: {
      name: "OzBargain",
      sourceType: "community",
      baseUrl: "https://www.ozbargain.com.au",
      trustScore: 65,
      language: "en",
    },
  });
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
