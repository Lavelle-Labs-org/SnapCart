import { describe, it, expect, vi } from "vitest";
import {
  validatePickupCode,
  submitOrderAction,
} from "../order-actions";

describe("OrderActions Helpers & API Calls (FE-010, Issue #33)", () => {
  describe("Pickup Code Validation (FR-20, Invariant #2)", () => {
    it("accepts valid 4-digit decimal codes", () => {
      expect(validatePickupCode("1234")).toEqual({ isValid: true });
      expect(validatePickupCode("0000")).toEqual({ isValid: true });
      expect(validatePickupCode("9876")).toEqual({ isValid: true });
    });

    it("rejects invalid, non-4-digit or non-numeric codes", () => {
      expect(validatePickupCode("").isValid).toBe(false);
      expect(validatePickupCode("123").isValid).toBe(false);
      expect(validatePickupCode("12345").isValid).toBe(false);
      expect(validatePickupCode("abcd").isValid).toBe(false);
      expect(validatePickupCode("12a4").isValid).toBe(false);
    });
  });

  describe("Order Action Submission: submitOrderAction() (FR-18)", () => {
    it("submits accept transition to POST /api/orders/:id/accept", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "ord-1", state: "accepted" }),
      });

      const res = await submitOrderAction("ord-1", "accept", undefined, mockFetch as any);
      expect(mockFetch).toHaveBeenCalledWith("/api/orders/ord-1/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      expect(res.success).toBe(true);
      expect(res.state).toBe("accepted");
    });

    it("submits reject transition to POST /api/orders/:id/reject", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "ord-1", state: "rejected" }),
      });

      const res = await submitOrderAction("ord-1", "reject", undefined, mockFetch as any);
      expect(mockFetch).toHaveBeenCalledWith("/api/orders/ord-1/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      expect(res.success).toBe(true);
      expect(res.state).toBe("rejected");
    });

    it("submits ready transition to POST /api/orders/:id/ready", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "ord-1", state: "ready" }),
      });

      const res = await submitOrderAction("ord-1", "ready", undefined, mockFetch as any);
      expect(mockFetch).toHaveBeenCalledWith("/api/orders/ord-1/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      expect(res.success).toBe(true);
      expect(res.state).toBe("ready");
    });

    it("validates code and submits complete handover to POST /api/orders/:id/complete", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "ord-1", state: "completed" }),
      });

      const res = await submitOrderAction("ord-1", "complete", "4321", mockFetch as any);
      expect(mockFetch).toHaveBeenCalledWith("/api/orders/ord-1/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "4321", pickupCode: "4321" }),
      });
      expect(res.success).toBe(true);
      expect(res.state).toBe("completed");
    });

    it("throws client-side error before fetch when pickup code is invalid on complete", async () => {
      const mockFetch = vi.fn();
      await expect(submitOrderAction("ord-1", "complete", "12", mockFetch as any)).rejects.toThrow(
        "Pickup code must be exactly 4 digits"
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("submits reissue pickup code to POST /api/orders/:id/pickup-code/reissue", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ reissued: true, message: "Code reissued" }),
      });

      const res = await submitOrderAction("ord-1", "reissue", undefined, mockFetch as any);
      expect(mockFetch).toHaveBeenCalledWith("/api/orders/ord-1/pickup-code/reissue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: undefined,
      });
      expect(res.success).toBe(true);
      expect(res.message).toBe("Code reissued");
    });

    it("handles error responses from server with descriptive message", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Invalid pickup code. 3 attempts remaining." }),
      });

      await expect(submitOrderAction("ord-1", "complete", "9999", mockFetch as any)).rejects.toThrow(
        "Invalid pickup code. 3 attempts remaining."
      );
    });
  });
});
