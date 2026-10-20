import { describe, it, expect, vi } from "vitest";
import { validateLoginForm, submitLogin } from "../login-form";

describe("Seller Login Form & Logic (FE-008, #31)", () => {
  describe("Input Validation", () => {
    it("accepts valid Ethio Telecom phone numbers (09...)", () => {
      const res = validateLoginForm({
        phone: "0911223344",
        password: "password123",
      });

      expect(res.isValid).toBe(true);
      expect(res.normalizedPhone).toBe("0911223344");
      expect(res.errors).toEqual({});
    });

    it("accepts valid Safaricom Ethiopia phone numbers (07... or +2517...)", () => {
      const res = validateLoginForm({
        phone: "+251712345678",
        password: "password123",
      });

      expect(res.isValid).toBe(true);
      expect(res.normalizedPhone).toBe("0712345678");
      expect(res.errors).toEqual({});
    });

    it("rejects invalid or malformed phone numbers", () => {
      const res = validateLoginForm({
        phone: "0812345678",
        password: "password123",
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.phone).toBeDefined();
    });

    it("requires password to be non-empty", () => {
      const res = validateLoginForm({
        phone: "0911223344",
        password: "",
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.password).toBe("Password is required");
    });
  });

  describe("API Submission: POST /api/auth/login", () => {
    it("submits normalized phone and password to /api/auth/login (Acceptance Criterion 1)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            seller: {
              id: "seller-uuid-1",
              business_name: "Habesha Cafe",
              phone: "0911223344",
              slug: "habesha-cafe",
            },
          }),
      });

      const credentials = {
        phone: "0911223344",
        password: "securepassword",
      };

      const res = await submitLogin(credentials, mockFetch as any);

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      expect(res.seller.id).toBe("seller-uuid-1");
    });

    it("handles invalid credentials error without clearing phone state (Acceptance Criterion 2)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            code: "INVALID_CREDENTIALS",
            message: "Invalid phone number or password",
          }),
      });

      const credentials = {
        phone: "0911223344",
        password: "wrongpassword",
      };

      await expect(submitLogin(credentials, mockFetch as any)).rejects.toThrow(
        "Invalid phone number or password"
      );

      // Verify credentials object retained original phone
      expect(credentials.phone).toBe("0911223344");
    });

    it("handles unverified phone error correctly", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            code: "PHONE_NOT_VERIFIED",
            message:
              "Phone number has not been verified yet. Please complete phone verification.",
          }),
      });

      await expect(
        submitLogin(
          { phone: "0922334455", password: "password123" },
          mockFetch as any
        )
      ).rejects.toThrow("Phone number has not been verified yet");
    });
  });
});
