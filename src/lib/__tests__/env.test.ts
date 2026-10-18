import { describe, it, expect } from "vitest";
import { validateEnv, envSchema } from "@/env";

describe("Environment Validation Schema (INFRA-001)", () => {
  const validMockEnv = {
    SMSHUB_API_KEY: "mock_api_key_for_unit_tests",
    SMSHUB_WEBHOOK_SECRET: "mock_webhook_secret_for_unit_tests",
    SMSHUB_MODE: "test",
    SESSION_SECRET: "mock_session_secret_at_least_32_characters_long",
    PICKUP_CODE_SECRET: "mock_pickup_code_secret_at_least_32_chars",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/order_by_sms?schema=public",
    NEXT_PUBLIC_APP_URL: "https://ord.et",
    SMS_ALLOWLIST: "0911223344,0711223344",
    SMS_DAILY_CAP: "50",
    SMS_SENDING_PAUSED: "false",
  };

  it("successfully parses and returns type-safe environment configuration", () => {
    const result = validateEnv(validMockEnv);
    expect(result.SMSHUB_API_KEY).toBe("mock_api_key_for_unit_tests");
    expect(result.SMSHUB_MODE).toBe("test");
    expect(result.NEXT_PUBLIC_APP_URL).toBe("https://ord.et");
    expect(result.SMS_DAILY_CAP).toBe(50);
    expect(result.SMS_SENDING_PAUSED).toBe(false);
  });

  it("throws validation error when SESSION_SECRET is missing", () => {
    const envWithoutSession = { ...validMockEnv };
    delete (envWithoutSession as any).SESSION_SECRET;

    expect(() => validateEnv(envWithoutSession)).toThrowError(/SESSION_SECRET/);
  });

  it("throws validation error when SMSHUB_API_KEY is missing", () => {
    const envWithoutApiKey = { ...validMockEnv };
    delete (envWithoutApiKey as any).SMSHUB_API_KEY;

    expect(() => validateEnv(envWithoutApiKey)).toThrowError(/SMSHUB_API_KEY/);
  });

  it("constrains SMSHUB_MODE strictly to 'test' | 'live'", () => {
    expect(() =>
      validateEnv({
        ...validMockEnv,
        SMSHUB_MODE: "invalid_mode" as any,
      })
    ).toThrowError(/SMSHUB_MODE/);

    const liveEnv = validateEnv({
      ...validMockEnv,
      SMSHUB_MODE: "live",
    });
    expect(liveEnv.SMSHUB_MODE).toBe("live");
  });

  it("validates NEXT_PUBLIC_APP_URL as a valid URL string", () => {
    expect(() =>
      validateEnv({
        ...validMockEnv,
        NEXT_PUBLIC_APP_URL: "not-a-valid-url",
      })
    ).toThrowError(/NEXT_PUBLIC_APP_URL/);
  });

  it("enforces minimum 32 character length on SESSION_SECRET and PICKUP_CODE_SECRET", () => {
    expect(() =>
      validateEnv({
        ...validMockEnv,
        SESSION_SECRET: "too_short_secret",
      })
    ).toThrowError(/SESSION_SECRET/);

    expect(() =>
      validateEnv({
        ...validMockEnv,
        PICKUP_CODE_SECRET: "short",
      })
    ).toThrowError(/PICKUP_CODE_SECRET/);
  });

  it("applies defaults for SMSHUB_MODE, SMS_DAILY_CAP, and SMS_SENDING_PAUSED", () => {
    const minimalEnv = {
      SMSHUB_API_KEY: "mock_api_key_12345",
      SESSION_SECRET: "mock_session_secret_at_least_32_characters_long",
      PICKUP_CODE_SECRET: "mock_pickup_code_secret_at_least_32_chars",
      DATABASE_URL: "postgresql://localhost:5432/db",
      NEXT_PUBLIC_APP_URL: "https://ord.et",
    };

    const result = validateEnv(minimalEnv);
    expect(result.SMSHUB_MODE).toBe("test");
    expect(result.SMS_DAILY_CAP).toBe(50);
    expect(result.SMS_SENDING_PAUSED).toBe(false);
  });

  it("rejects default or placeholder development secrets in production mode", () => {
    expect(() =>
      validateEnv({
        ...validMockEnv,
        NODE_ENV: "production",
        SESSION_SECRET: "replace_with_at_least_32_random_characters_for_sessions",
      })
    ).toThrowError(/SESSION_SECRET cannot use default or placeholder development secret in production/);

    expect(() =>
      validateEnv({
        ...validMockEnv,
        NODE_ENV: "production",
        SESSION_SECRET: "development_session_secret_for_local_testing_only",
      })
    ).toThrowError(/SESSION_SECRET cannot use default or placeholder development secret in production/);
  });

  it("accepts strong production secret in production mode", () => {
    const prodResult = validateEnv({
      ...validMockEnv,
      NODE_ENV: "production",
      SESSION_SECRET: "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
    });
    expect(prodResult.SESSION_SECRET).toBe(
      "7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"
    );
  });
});
