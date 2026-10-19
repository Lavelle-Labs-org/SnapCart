import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { MockSMSHubServer } from "../smshub-server";

describe("MockSMSHubServer (QA-001, #38)", () => {
  let mockServer: MockSMSHubServer;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = new MockSMSHubServer({ initialBalance: 50, defaultOtp: "654321" });
    baseUrl = await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.reset();
  });

  describe("POST /api/sms (Live SMS Simulation)", () => {
    it("returns valid 200 response with dummy msg_... ID and decreases credit", async () => {
      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msisdn: "0911223344",
          text: "Order #1001 is ready",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("success");
      expect(data.data.message_id).toMatch(/^msg_[0-9a-f]{20}$/);
      expect(data.data.network).toBe("ethio_telecom");
      expect(data.data.message_status).toBe("sent");
      expect(data.data.credits_used).toBe(1);

      // Verify request logged
      const messages = mockServer.getSentMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].msisdn).toBe("0911223344");
      expect(messages[0].text).toBe("Order #1001 is ready");
    });

    it("correctly identifies Safaricom network for 07... numbers", async () => {
      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msisdn: "0711223344",
          text: "Safaricom test message",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.data.network).toBe("safaricom");
    });
  });

  describe("POST /api/test (Test Mode Simulation - 0 Credits)", () => {
    it("returns 200 with would_send: true without consuming credits", async () => {
      const balanceBeforeRes = await fetch(`${baseUrl}/api/balance`);
      const balanceBefore = await balanceBeforeRes.json();

      const res = await fetch(`${baseUrl}/api/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msisdn: "0911223344",
          text: "Test mode verification",
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("success");
      expect(data.data.would_send).toBe(true);
      expect(data.data.encoding).toBe("GSM-7");

      const balanceAfterRes = await fetch(`${baseUrl}/api/balance`);
      const balanceAfter = await balanceAfterRes.json();
      expect(balanceAfter.data.credits).toBe(balanceBefore.data.credits);
    });
  });

  describe("Error Simulations on Demand (Acceptance Criteria)", () => {
    it("simulates 502 Bad Gateway / carrier down error on demand", async () => {
      mockServer.simulateBadGateway("/api/sms");

      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn: "0911223344", text: "Hello" }),
      });

      expect(res.status).toBe(502);
      const data = await res.json();
      expect(data.status).toBe("error");
      expect(data.error_type).toBe("provider_error");
    });

    it("simulates 429 Rate Limited error with Retry-After header on demand", async () => {
      mockServer.simulateRateLimit("/api/sms", 7);

      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn: "0911223344", text: "Hello" }),
      });

      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("7");
      const data = await res.json();
      expect(data.status).toBe("error");
      expect(data.error_type).toBe("rate_limited");
    });

    it("simulates 402 Insufficient Credits error on demand", async () => {
      mockServer.simulateInsufficientCredits("/api/sms");

      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn: "0911223344", text: "Hello" }),
      });

      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.status).toBe("error");
      expect(data.error_type).toBe("insufficient_credits");
    });

    it("simulates 422 Carrier / Validation error on demand", async () => {
      mockServer.simulateCarrierError("/api/sms", "carrier_rejected", "Carrier rejected SMS");

      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn: "0911223344", text: "Hello" }),
      });

      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.status).toBe("error");
      expect(data.error_type).toBe("carrier_rejected");
    });

    it("restores normal 200 operation after clearSimulatedErrors", async () => {
      mockServer.simulateBadGateway("/api/sms");
      mockServer.clearSimulatedErrors();

      const res = await fetch(`${baseUrl}/api/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msisdn: "0911223344", text: "Hello" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("success");
    });
  });

  describe("Phone Verification API (/api/verify/*)", () => {
    it("handles verify/send and verify/check cycle with accurate status", async () => {
      mockServer.setDefaultOtp("889900");

      // 1. Send OTP
      const sendRes = await fetch(`${baseUrl}/api/verify/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msisdn: "0911223344",
          app_name: "Habesha Roastery",
          code_length: 6,
        }),
      });

      expect(sendRes.status).toBe(200);
      const sendData = await sendRes.json();
      expect(sendData.status).toBe("success");
      const verificationId = sendData.data.verification_id;
      expect(verificationId).toMatch(/^ver_[0-9a-f]{20}$/);

      // 2. Check with wrong code
      const wrongRes = await fetch(`${baseUrl}/api/verify/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verificationId,
          code: "000000",
        }),
      });
      const wrongData = await wrongRes.json();
      expect(wrongData.data.valid).toBe(false);
      expect(wrongData.data.verification_status).toBe("failed");

      // 3. Check with correct code
      const correctRes = await fetch(`${baseUrl}/api/verify/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verification_id: verificationId,
          code: "889900",
        }),
      });
      const correctData = await correctRes.json();
      expect(correctData.data.valid).toBe(true);
      expect(correctData.data.verification_status).toBe("approved");
    });
  });

  describe("Webhook Signature Generation", () => {
    it("generates HMAC-SHA256 headers compatible with SMSHub webhook signature spec", () => {
      const rawBody = JSON.stringify({ event: "message.sent", message_id: "msg_123" });
      const secret = "test_webhook_signing_secret";

      const headers = mockServer.createWebhookHeaders(rawBody, "message.sent", secret, "del_abc", 1700000000);

      expect(headers["X-SMSHub-Event"]).toBe("message.sent");
      expect(headers["X-SMSHub-Delivery"]).toBe("del_abc");
      expect(headers["X-SMSHub-Signature"]).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    });
  });
});
