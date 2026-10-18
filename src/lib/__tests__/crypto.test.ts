import { describe, it, expect } from "vitest";
import {
  generateActionToken,
  hashActionToken,
  generatePickupCode,
  hashPickupCode,
  verifyPickupCodeHash,
  verifySMSHubWebhookSignature,
} from "../crypto";
import crypto from "crypto";

describe("Crypto Utilities", () => {
  it("generates 22-char url-safe action tokens", () => {
    const token = generateActionToken();
    expect(token).toHaveLength(22);
    const hash = hashActionToken(token);
    expect(hash).toHaveLength(64); // SHA-256 hex
  });

  it("generates 4-digit pickup code and verifies keyed hash", () => {
    const code = generatePickupCode();
    expect(code).toMatch(/^\d{4}$/);

    const secret = "test_pickup_secret_1234567890123456";
    const hash = hashPickupCode(code, secret);
    expect(verifyPickupCodeHash(code, hash, secret)).toBe(true);
    expect(verifyPickupCodeHash("0000", hash, secret)).toBe(false);
  });

  it("verifies webhook signature correctly", () => {
    const secret = "test_webhook_secret_key";
    const body = JSON.stringify({ event: "message.sent", data: { id: "msg_123" } });
    const now = Math.floor(Date.now() / 1000);
    const data = `${now}.${body}`;
    const v1 = crypto.createHmac("sha256", secret).update(data).digest("hex");
    const header = `t=${now},v1=${v1}`;

    const res = verifySMSHubWebhookSignature(body, header, secret);
    expect(res.isValid).toBe(true);

    const badRes = verifySMSHubWebhookSignature(body, `t=${now},v1=badhash`, secret);
    expect(badRes.isValid).toBe(false);
  });
});
