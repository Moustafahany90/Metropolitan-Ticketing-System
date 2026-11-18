import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  AD_URL: z.string().min(1),
  AD_BASE_DN: z.string().min(1),
  AD_USER_SEARCH_BASE: z.string().min(1),
  AD_USER_LOGIN_ATTRIBUTE: z.string().default("sAMAccountName"),
  AD_TECHNICIAN_GROUPS: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  // Optional SMTP settings. Email notifications are DISABLED (safe no-op) until
  // SMTP_HOST and MAIL_FROM are both set.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? false : value === "true")),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
