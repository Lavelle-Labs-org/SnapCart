import { z } from "zod";

export const frontendEnvSchema = z.object({
  INTERNAL_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export const env = frontendEnvSchema.parse({
  INTERNAL_API_URL: process.env.INTERNAL_API_URL || "http://localhost:4000",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});
