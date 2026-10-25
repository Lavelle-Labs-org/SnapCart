import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";

/**
 * Automatically loads .env files using Node.js built-in process.loadEnvFile().
 * Precedence hierarchy (highest to lowest, does not overwrite variables already set in process.env):
 * 1. .env.[NODE_ENV].local (e.g. .env.development.local)
 * 2. .env.local
 * 3. .env.[NODE_ENV] (e.g. .env.development)
 * 4. .env
 */
export function loadEnvironmentFiles(): void {
  if (typeof process.loadEnvFile !== "function") {
    return;
  }

  const nodeEnv = process.env.NODE_ENV || "development";
  const envCandidates = [
    `.env.${nodeEnv}.local`,
    ".env.local",
    `.env.${nodeEnv}`,
    ".env",
  ];

  const searchDirs = [
    process.cwd(),
    path.resolve(process.cwd(), "../.."),
    path.resolve(__dirname, "../../.."),
  ];

  const uniqueDirs = Array.from(new Set(searchDirs));

  for (const dir of uniqueDirs) {
    for (const file of envCandidates) {
      const fullPath = path.resolve(dir, file);
      if (fs.existsSync(fullPath)) {
        try {
          process.loadEnvFile(fullPath);
        } catch {
          // Ignore parse or permission errors
        }
      }
    }
  }
}

// Ensure environment files are loaded upon module initialization
loadEnvironmentFiles();

/**
 * NestJS Backend Environment Validation Schema (MIG-002)
 *
 * Validates backend environment variables and fails fast with
 * actionable errors during NestJS server startup.
 * References: docs/05, docs/06, docs/07, docs/15.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
    PORT: z.coerce.number().int().positive().default(4000),

    // SMSHub API Credentials (never commit live keys)
    SMSHUB_API_KEY: z
      .string()
      .min(1, "SMSHUB_API_KEY is required and cannot be empty"),
    SMSHUB_WEBHOOK_SECRET: z.string().optional(),
    SMSHUB_BASE_URL: z.string().url("SMSHUB_BASE_URL must be a valid URL").optional(),

    // SMSHub Execution Mode: "test" (calls /api/test, 0 credits) or "live" (calls /api/sms)
    SMSHUB_MODE: z
      .enum(["test", "live"], {
        message: "SMSHUB_MODE must be either 'test' or 'live'",
      })
      .default("test"),

    // Security Secrets
    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters long for secure session cookies"),
    PICKUP_CODE_SECRET: z
      .string()
      .min(32, "PICKUP_CODE_SECRET must be at least 32 characters long for HMAC pickup code hashing"),

    // Database Connection
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required"),

    // Public Application URL / Frontend URL
    NEXT_PUBLIC_APP_URL: z
      .string()
      .url("NEXT_PUBLIC_APP_URL must be a valid URL (e.g. https://ord.et)")
      .optional()
      .default("http://localhost:3000"),

    FRONTEND_URL: z
      .string()
      .url("FRONTEND_URL must be a valid URL")
      .optional()
      .default("http://localhost:3000"),

    // Abuse & Rate Guardrails (optional / with sensible defaults)
    SMS_ALLOWLIST: z.string().optional(),
    SMS_DAILY_CAP: z.coerce
      .number()
      .int()
      .positive("SMS_DAILY_CAP must be a positive integer")
      .default(50),
    SMS_SENDING_PAUSED: z
      .preprocess((val) => {
        if (typeof val === "boolean") return val;
        if (typeof val === "string") return val.toLowerCase() === "true";
        return false;
      }, z.boolean())
      .default(false),

    // Rate Limiting Config (configurable per-environment)
    RATE_LIMIT_PHONE_MAX: z.coerce.number().int().positive().default(5),
    RATE_LIMIT_PHONE_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
    RATE_LIMIT_IP_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_IP_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
    RATE_LIMIT_OTP_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_OTP_EXPIRY_SECONDS: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_PICKUP_CODE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

    // Chapa Payment Gateway & Seller Billing
    CHAPA_PUBLIC_KEY: z.string().optional().default("CHAPUBK_TEST-mock-key"),
    CHAPA_SECRET_KEY: z.string().optional().default("CHASECK_TEST-mock-key"),
    CHAPA_WEBHOOK_SECRET: z.string().optional().default("mock-chapa-webhook-secret"),
    CHAPA_BASE_URL: z.string().url().optional().default("https://api.chapa.co/v1"),
    FREE_TRIAL_SMS_CREDITS: z.coerce.number().int().nonnegative().default(10),
  })
  .superRefine((data, ctx) => {
    const isProd = data.NODE_ENV === "production" || process.env.NODE_ENV === "production";
    if (isProd) {
      const lower = data.SESSION_SECRET.toLowerCase();
      const isPlaceholder =
        lower.includes("replace_with") ||
        lower.includes("mock_session") ||
        lower.includes("development") ||
        lower.includes("changeme") ||
        lower.includes("example") ||
        lower.includes("secret_at_least_32");

      if (isPlaceholder) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SESSION_SECRET"],
          message:
            "SESSION_SECRET cannot use default or placeholder development secret in production",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validates an environment variable map against envSchema.
 * Throws a formatted, informative Error if validation fails.
 */
export function validateEnv(customEnv: Record<string, unknown> = process.env): Env {
  if (customEnv === process.env) {
    loadEnvironmentFiles();
  }
  const result = envSchema.safeParse(customEnv);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const formattedErrors = Object.entries(fieldErrors)
      .map(([field, errors]) => `  - ${field}: ${errors?.join(", ")}`)
      .join("\n");

    const message = `❌ Missing or invalid environment configuration in apps/api:\n${formattedErrors}\n\nPlease check your .env file against .env.example.`;
    throw new Error(message);
  }

  return result.data;
}

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Type-safe environment variables proxy for apps/api.
 * Lazily validates process.env upon first property access.
 * Set SKIP_ENV_VALIDATION="true" to bypass validation in CI or build environments.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== "string") return undefined;
    if (process.env.SKIP_ENV_VALIDATION === "true") {
      return process.env[prop];
    }
    return getEnv()[prop as keyof Env];
  },
});
