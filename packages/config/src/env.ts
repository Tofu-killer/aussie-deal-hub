import { z } from "zod";

const smtpSecureSchema = z.preprocess((value) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return value;
}, z.boolean().default(false));

const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url(),
    SESSION_SECRET: z.string().min(16),
    EMAIL_FROM: z.string().email(),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: smtpSecureSchema,
    SMTP_USER: z.string().min(1).optional(),
    SMTP_PASS: z.string().min(1).optional(),
    AUTH_CODE_TTL_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production" && !env.SMTP_HOST) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_HOST is required in production.",
        path: ["SMTP_HOST"],
      });
    }

    if (env.NODE_ENV === "production" && !env.SMTP_PORT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_PORT is required in production.",
        path: ["SMTP_PORT"],
      });
    }

    if (env.SMTP_HOST && !env.SMTP_PORT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_PORT is required when SMTP_HOST is set.",
        path: ["SMTP_PORT"],
      });
    }

    if (env.SMTP_PORT && !env.SMTP_HOST) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_HOST is required when SMTP_PORT is set.",
        path: ["SMTP_HOST"],
      });
    }

    if (env.SMTP_USER && !env.SMTP_PASS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_PASS is required when SMTP_USER is set.",
        path: ["SMTP_PASS"],
      });
    }

    if (env.SMTP_PASS && !env.SMTP_USER) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMTP_USER is required when SMTP_PASS is set.",
        path: ["SMTP_USER"],
      });
    }
  });

export function parseApiEnv(input: Record<string, string | undefined>) {
  return apiEnvSchema.parse(input);
}
