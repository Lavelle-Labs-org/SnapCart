import { describe, it, expect, vi } from "vitest";
import { ChapaService } from "../chapa.service";
import { createHmac } from "crypto";

describe("ChapaService", () => {
  const chapaService = new ChapaService();

  describe("verifyWebhookSignature", () => {
    it("returns true for a valid HMAC SHA-256 signature", () => {
      const secret = "test_webhook_secret_key";
      const payload = JSON.stringify({ tx_ref: "obs_test_123", status: "success" });
      const validSignature = createHmac("sha256", secret).update(payload).digest("hex");

      // Set secret on instance
      (chapaService as any).webhookSecret = secret;

      const isValid = chapaService.verifyWebhookSignature(validSignature, payload);
      expect(isValid).toBe(true);
    });

    it("returns false for a tampered signature", () => {
      const secret = "test_webhook_secret_key";
      const payload = JSON.stringify({ tx_ref: "obs_test_123", status: "success" });
      (chapaService as any).webhookSecret = secret;

      const isValid = chapaService.verifyWebhookSignature("invalid_signature_hex", payload);
      expect(isValid).toBe(false);
    });

    it("returns false when signature is missing", () => {
      const isValid = chapaService.verifyWebhookSignature(undefined, "{}");
      expect(isValid).toBe(false);
    });
  });

  describe("initializeTransaction (mock/test mode)", () => {
    it("returns mock checkout link when in test mode or test key is used", async () => {
      const res = await chapaService.initializeTransaction({
        amount: 180,
        currency: "ETB",
        email: "test@order-by-sms.local",
        firstName: "Test Seller",
        phoneNumber: "0911223344",
        txRef: "obs_unit_123",
        callbackUrl: "http://localhost:3000/api/webhooks/chapa",
        returnUrl: "http://localhost:3000/dashboard/billing/return?tx_ref=obs_unit_123",
      });

      expect(res.status).toBe("success");
      expect(res.checkoutUrl).toBeDefined();
      expect(res.checkoutUrl).toContain("obs_unit_123");
    });

    it("clamps customization.title to max 16 chars when calling Chapa API", async () => {
      const service = new ChapaService();
      (service as any).secretKey = "CHASECK_LIVE_REAL_KEY";
      vi.stubEnv("NODE_ENV", "production");

      let capturedPayload: any = null;
      const originalFetch = global.fetch;
      global.fetch = async (_url: any, init: any) => {
        capturedPayload = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({
            status: "success",
            message: "Hosted Link",
            data: { checkout_url: "https://checkout.chapa.co/pay/123" },
          }),
        } as any;
      };

      try {
        await service.initializeTransaction({
          amount: 50,
          currency: "ETB",
          email: "seller@snapcart.et",
          firstName: "Very Long Business Name Exceeding Thirty Characters Here",
          phoneNumber: "0911223344",
          txRef: "obs_test_limit",
          callbackUrl: "https://snapcart.et/api/webhooks/chapa",
          returnUrl: "https://snapcart.et/dashboard/billing/return",
          title: "Snapcart SMS Credits Too Long", // 29 chars
          description: "A".repeat(150),
        });

        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload.customization.title.length).toBeLessThanOrEqual(16);
        expect(capturedPayload.customization.title).toBe("Snapcart SMS Cre");
        expect(capturedPayload.first_name.length).toBeLessThanOrEqual(30);
        expect(capturedPayload.customization.description.length).toBeLessThanOrEqual(100);
      } finally {
        global.fetch = originalFetch;
        vi.unstubAllEnvs();
      }
    });
  });
});
