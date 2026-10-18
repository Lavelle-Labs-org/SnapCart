import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateEnv, envSchema } from "../env";

describe("NestJS Backend Environment Configuration (apps/api)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const validConfig = {
    NODE_ENV: "test",
    PORT: "4000",
    SMSHUB_API_KEY: "test_smshub_api_key_12345",
    SMSHUB_MODE: "test",
    SESSION_SECRET: "strong_session_secret_at_least_32_characters_long!",
    PICKUP_CODE_SECRET: "strong_pickup_code_secret_at_least_32_chars!",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/order_by_sms?schema=public",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    FRONTEND_URL: "http://localhost:3000",
    SMS_DAILY_CAP: "50",
    SMS_SENDING_PAUSED: "false",
  };

  it("successfully parses valid environment configuration", () => {
    const parsed = validateEnv(validConfig);
    expect(parsed.SMSHUB_API_KEY).toBe("test_smshub_api_key_12345");
    expect(parsed.SMSHUB_MODE).toBe("test");
    expect(parsed.PORT).toBe(4000);
    expect(parsed.SMS_DAILY_CAP).toBe(50);
    expect(parsed.SMS_SENDING_PAUSED).toBe(false);
  });

  it("throws actionable error when SMSHUB_API_KEY is missing", () => {
    const invalid = { ...validConfig, SMSHUB_API_KEY: "" };
    expect(() => validateEnv(invalid)).toThrowError(/SMSHUB_API_KEY/);
  });

  it("throws actionable error when SESSION_SECRET is shorter than 32 characters", () => {
    const invalid = { ...validConfig, SESSION_SECRET: "too_short_secret" };
    expect(() => validateEnv(invalid)).toThrowError(/SESSION_SECRET must be at least 32 characters/);
  });

  it("rejects placeholder development secrets in production mode", () => {
    const prodWithPlaceholder = {
      ...validConfig,
      NODE_ENV: "production",
      SESSION_SECRET: "development_secret_key_at_least_32_chars_long!",
    };
    expect(() => validateEnv(prodWithPlaceholder)).toThrowError(/cannot use default or placeholder/);
  });
});
