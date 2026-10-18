import { describe, it, expect, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { CryptoService } from "../crypto.service";
import crypto from "crypto";

describe("CryptoService (apps/api)", () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptoService],
    }).compile();

    service = module.get<CryptoService>(CryptoService);
  });

  it("should be defined and injectable", () => {
    expect(service).toBeDefined();
  });

  describe("Action Tokens (FR-21)", () => {
    it("generates 22-char url-safe action tokens and 64-char sha-256 hashes", () => {
      const token = service.generateActionToken();
      expect(token).toHaveLength(22);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);

      const hash = service.hashActionToken(token);
      expect(hash).toHaveLength(64);
    });

    it("generates distinct tokens on subsequent calls", () => {
      const token1 = service.generateActionToken();
      const token2 = service.generateActionToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("Pickup Codes (Section 9.2)", () => {
    it("generates 4-digit numeric pickup code and verifies keyed hash", () => {
      const code = service.generatePickupCode();
      expect(code).toMatch(/^\d{4}$/);

      const secret = "test_pickup_secret_1234567890123456";
      const hash = service.hashPickupCode(code, secret);
      expect(service.verifyPickupCodeHash(code, hash, secret)).toBe(true);
      expect(service.verifyPickupCodeHash("0000", hash, secret)).toBe(false);
    });

    it("fails verification on malformed hash or mismatched secret", () => {
      const code = service.generatePickupCode();
      const secret = "test_pickup_secret_1234567890123456";
      const hash = service.hashPickupCode(code, secret);

      expect(service.verifyPickupCodeHash(code, "invalid_hex", secret)).toBe(false);
      expect(service.verifyPickupCodeHash(code, hash, "different_secret")).toBe(false);
    });
  });

  describe("SMSHub Webhook Signatures (Section 8.4)", () => {
    it("verifies valid webhook signature", () => {
      const secret = "test_webhook_secret_key";
      const body = JSON.stringify({ event: "message.sent", data: { id: "msg_123" } });
      const now = Math.floor(Date.now() / 1000);
      const data = `${now}.${body}`;
      const v1 = crypto.createHmac("sha256", secret).update(data).digest("hex");
      const header = `t=${now},v1=${v1}`;

      const res = service.verifySMSHubWebhookSignature(body, header, secret);
      expect(res.isValid).toBe(true);
    });

    it("rejects expired webhook signatures (> 300 seconds)", () => {
      const secret = "test_webhook_secret_key";
      const body = JSON.stringify({ event: "message.sent" });
      const oldTime = Math.floor(Date.now() / 1000) - 350;
      const data = `${oldTime}.${body}`;
      const v1 = crypto.createHmac("sha256", secret).update(data).digest("hex");
      const header = `t=${oldTime},v1=${v1}`;

      const res = service.verifySMSHubWebhookSignature(body, header, secret);
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/expired/);
    });

    it("rejects malformed or tampered signatures", () => {
      const secret = "test_webhook_secret_key";
      const body = JSON.stringify({ event: "message.sent" });
      const now = Math.floor(Date.now() / 1000);

      const resBadHeader = service.verifySMSHubWebhookSignature(body, "invalid_header", secret);
      expect(resBadHeader.isValid).toBe(false);

      const resTampered = service.verifySMSHubWebhookSignature(body, `t=${now},v1=badhash`, secret);
      expect(resTampered.isValid).toBe(false);
    });
  });
});
