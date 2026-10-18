import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("Password Hashing & Verification (INFRA-002, FR-1)", () => {
  const samplePassword = "CorrectHorseBatteryStaple10!";
  const wrongPassword = "WrongPassword123!";

  it("hashes password with bcrypt generating a salted hash", async () => {
    const hash = await hashPassword(samplePassword);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    // bcrypt hashes start with $2a$ or $2b$
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
  });

  it("generates different hashes for identical passwords due to unique salts", async () => {
    const hash1 = await hashPassword(samplePassword);
    const hash2 = await hashPassword(samplePassword);
    expect(hash1).not.toBe(hash2);
  });

  it("verifies matching password successfully", async () => {
    const hash = await hashPassword(samplePassword);
    const isValid = await verifyPassword(samplePassword, hash);
    expect(isValid).toBe(true);
  });

  it("rejects non-matching password", async () => {
    const hash = await hashPassword(samplePassword);
    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it("safely returns false for malformed or corrupted hashes", async () => {
    const isValid = await verifyPassword(samplePassword, "not-a-valid-bcrypt-hash");
    expect(isValid).toBe(false);
  });

  it("safely handles empty password strings", async () => {
    const hash = await hashPassword(samplePassword);
    const isValid = await verifyPassword("", hash);
    expect(isValid).toBe(false);
  });
});
