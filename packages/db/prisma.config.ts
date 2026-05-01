import { defineConfig } from "prisma/config";

export const defaultLocalDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:5432/aussie_deals_hub";
export const localDatabaseUrlFallbackEnvName = "ALLOW_LOCAL_DATABASE_URL_FALLBACK";

function normalizeEnvValue(rawValue: string | undefined) {
  const trimmedValue = rawValue?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function parseBooleanEnv(rawValue: string | undefined) {
  const normalizedValue = normalizeEnvValue(rawValue)?.toLowerCase();

  if (normalizedValue === undefined) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(normalizedValue);
}

function resolveDatabaseUrl(env = process.env) {
  const configuredDatabaseUrl = normalizeEnvValue(env.DATABASE_URL);

  if (configuredDatabaseUrl) {
    return configuredDatabaseUrl;
  }

  if (parseBooleanEnv(env[localDatabaseUrlFallbackEnvName])) {
    return defaultLocalDatabaseUrl;
  }

  throw new Error(
    `DATABASE_URL is required for Prisma commands. Set ${localDatabaseUrlFallbackEnvName}=1 to opt into ${defaultLocalDatabaseUrl} for local-only development.`,
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx src/seed.ts"
  },
  engine: "classic",
  datasource: {
    url: resolveDatabaseUrl()
  }
});
