import { z } from "zod";

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  EMAIL_FROM: z.string().email()
});

export function parseApiEnv(input: Record<string, string | undefined>) {
  return apiEnvSchema.parse(input);
}
