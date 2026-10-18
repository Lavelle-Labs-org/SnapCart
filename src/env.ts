import { z } from "zod";

/**
 * Environment Validation Schema (INFRA-001)
 *
 * Validates all environment variables defined in .env.example
 * and fails fast with actionable errors during server startup.
 * References: docs/05, docs/06, docs/07.
 */
export const envSchema = z.object({
  // SMSHub API Credentials (never commit live keys)
  SMSHUB_API_KEY: z
    .string()
    .min(1, "SMSHUB_API_KEY is required and cannot be empty"),
  SMSHUB_WEBHOOK_SECRET: z.string().optional(),

  // SMSHub Execution Mode: "test" (calls /api/test, 0 credits) or "live" (calls /api/sms)
  SMSHUB_MODE: z
    .enum(["test", "live"], {
      errorMap: () => ({ message: "SMSHUB_MODE must be either 'test' or 'live'" }),
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

  // Public Application URL
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL (e.g. https://ord.et)"),

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
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates an environment variable map against envSchema.
 * Throws a formatted, informative Error if validation fails.
 */
export function validateEnv(customEnv: Record<string, unknown> = process.env): Env {
  const result = envSchema.safeParse(customEnv);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    const formattedErrors = Object.entries(fieldErrors)
      .map(([field, errors]) => `  - ${field}: ${errors?.join(", ")}`)
      .join("\n");

    const message = `❌ Missing or invalid environment configuration:\n${formattedErrors}\n\nPlease check your .env file against .env.example.`;
    throw new Error(message);
  }

  return result.data;
}

let cachedEnv: Env | null = null;

function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv(process.env);
  }
  return cachedEnv;
}

/**
 * Type-safe environment variables proxy.
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
