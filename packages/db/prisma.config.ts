import { defineConfig } from "prisma/config";

const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub";
process.env.DATABASE_URL ??= defaultDatabaseUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx src/seed.ts"
  },
  engine: "classic",
  datasource: {
    url: process.env.DATABASE_URL
  }
});
