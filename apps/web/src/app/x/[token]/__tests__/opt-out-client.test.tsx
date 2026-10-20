import { describe, it, expect, vi } from "vitest";
import {
  submitOptOut,
  getOptOutInitialState,
  getConfirmationMessage,
} from "../opt-out-client";

describe("OptOutClient Logic & API Integration (FE-006, #29)", () => {
  describe("API Submission: POST /api/stop/[token]", () => {
    it("clicking 'Confirm Stop Text Updates' sends POST to /api/stop/[token]", async () => {
      const token = "tok_test_stop_123";
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            suppressed: true,
            phone: "09•• ••• 44",
          }),
      });

      const result = await submitOptOut(token, mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith("/api/stop/tok_test_stop_123", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      expect(result.suppressed).toBe(true);
    });

    it("handles already suppressed response correctly without error", async () => {
      const token = "tok_test_already_suppressed";
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            suppressed: true,
            alreadySuppressed: true,
          }),
      });

      const result = await submitOptOut(token, mockFetch as any);

      expect(result.suppressed).toBe(true);
      expect(result.alreadySuppressed).toBe(true);
    });

    it("throws user-friendly error message when API responds with error", async () => {
      const token = "tok_expired";
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            message: "Stop link has expired",
          }),
      });

      await expect(submitOptOut(token, mockFetch as any)).rejects.toThrow(
        "Stop link has expired"
      );
    });
  });

  describe("Initial State Handling", () => {
    it("initializes to 'idle' when not previously suppressed", () => {
      expect(getOptOutInitialState(null)).toBe("idle");
      expect(getOptOutInitialState({})).toBe("idle");
      expect(getOptOutInitialState({ alreadySuppressed: false })).toBe("idle");
    });

    it("initializes directly to 'already_suppressed' when already suppressed", () => {
      expect(getOptOutInitialState({ alreadySuppressed: true })).toBe(
        "already_suppressed"
      );
    });
  });

  describe("Confirmation State & Privacy Invariants", () => {
    it("success state displays confirmation message without exposing personal details", () => {
      const msg = getConfirmationMessage("success");
      expect(msg).toContain("You will no longer receive SMS notifications for this order");
      expect(msg).toContain("Your order is still being processed");

      // Verify no PII is included
      expect(msg).not.toContain("09");
      expect(msg).not.toContain("+251");
    });

    it("already suppressed state displays clear explanation without exposing personal details", () => {
      const msg = getConfirmationMessage("already_suppressed");
      expect(msg).toContain("Your phone number is already opted out");
      expect(msg).toContain("You will not receive text messages for this order");

      // Verify no PII is included
      expect(msg).not.toContain("09");
      expect(msg).not.toContain("+251");
    });
  });
});
