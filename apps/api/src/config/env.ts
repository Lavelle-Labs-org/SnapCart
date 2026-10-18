import { z } from "zod";

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
