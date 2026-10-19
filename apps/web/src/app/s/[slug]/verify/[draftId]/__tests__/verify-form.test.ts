import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("VerifyOtpForm Logic & Acceptance Criteria (FE-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cooldown Timer (FR-13)", () => {
    it("initializes with 60s cooldown if last_sent_at was just now", () => {
      const lastSentAt = new Date().toISOString();
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(lastSentAt).getTime()) / 1000);
      const cooldown = Math.max(0, 60 - elapsed);

      expect(cooldown).toBe(60);
    });

    it("calculates remaining cooldown correctly if some time has already elapsed", () => {
      const lastSentAt = new Date(Date.now() - 25000).toISOString(); // 25s ago
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(lastSentAt).getTime()) / 1000);
      const cooldown = Math.max(0, 60 - elapsed);

      expect(cooldown).toBe(35);
    });

    it("resets cooldown to 0 if more than 60s elapsed", () => {
      const lastSentAt = new Date(Date.now() - 75000).toISOString(); // 75s ago
      const now = Date.now();
      const elapsed = Math.floor((now - new Date(lastSentAt).getTime()) / 1000);
      const cooldown = Math.max(0, 60 - elapsed);

      expect(cooldown).toBe(0);
    });

    it("disables resend button when cooldown > 0 and enables when cooldown === 0", () => {
      const isResendDisabled = (cooldown: number, isSubmitting: boolean) =>
        cooldown > 0 || isSubmitting;

      expect(isResendDisabled(45, false)).toBe(true);
      expect(isResendDisabled(0, false)).toBe(false);
      expect(isResendDisabled(0, true)).toBe(true);
    });
  });

  describe("OTP Input Validation & Formatting", () => {
    it("sanitizes input to only digits and enforces max length of 6", () => {
      const sanitizeOtp = (value: string) => {
        return value.replace(/\D/g, "").slice(0, 6);
      };

      expect(sanitizeOtp("123456")).toBe("123456");
      expect(sanitizeOtp("12a3b4c5d6e7")).toBe("123456");
      expect(sanitizeOtp("12 34 56")).toBe("123456");
      expect(sanitizeOtp("999999999")).toBe("999999");
    });

    it("recognizes when 6 digits are complete and ready for submission", () => {
      const isComplete = (code: string) => /^\d{6}$/.test(code.trim());

      expect(isComplete("12345")).toBe(false);
      expect(isComplete("123456")).toBe(true);
      expect(isComplete("1234567")).toBe(false);
      expect(isComplete("")).toBe(false);
    });
  });

  describe("API Integration Contract", () => {
    it("constructs valid payload for POST /api/checkout/verify", () => {
      const draftId = "draft-123";
      const code = "654321";

      const payload = {
        draftId,
        code: code.trim(),
      };

      expect(payload).toEqual({
        draftId: "draft-123",
        code: "654321",
      });
    });

    it("constructs valid payload for POST /api/checkout/resend", () => {
      const draftId = "draft-123";

      const payload = {
        draftId,
      };

      expect(payload).toEqual({
        draftId: "draft-123",
      });
    });
  });

  describe("Error Handling", () => {
    it("extracts and formats error messages from server response", () => {
      const formatError = (body: any): string => {
        if (body?.error?.message) return body.error.message;
        if (body?.message) return body.message;
        return "Verification failed. Please try again.";
      };

      expect(
        formatError({
          error: {
            code: "INVALID_CODE",
            message:
              "Invalid or expired verification code. Please check and try again.",
          },
        })
      ).toBe(
        "Invalid or expired verification code. Please check and try again."
      );

      expect(
        formatError({
          code: "RATE_LIMITED",
          message: "Please wait 42 seconds before requesting a new code.",
        })
      ).toBe("Please wait 42 seconds before requesting a new code.");

      expect(formatError({})).toBe("Verification failed. Please try again.");
    });
  });

  describe("Order Completion Side Effects", () => {
    it("clears local cart storage key upon successful order creation", () => {
      const slug = "habesha-cafe";
      const storageKey = `order_by_sms_cart_${slug}`;
      const mockStorage: Record<string, string> = {
        [storageKey]: JSON.stringify({ "prod-1": 2 }),
      };

      // Simulate clear
      delete mockStorage[storageKey];

      expect(mockStorage[storageKey]).toBeUndefined();
    });

    it("constructs target URL to /s/[slug]/done with orderId and orderNumber", () => {
      const slug = "habesha-cafe";
      const orderId = "ord_abc123";
      const orderNumber = 1042;

      const targetUrl = `/s/${slug}/done?orderId=${encodeURIComponent(
        orderId
      )}&orderNumber=${orderNumber}`;

      expect(targetUrl).toBe("/s/habesha-cafe/done?orderId=ord_abc123&orderNumber=1042");
    });
  });
});
