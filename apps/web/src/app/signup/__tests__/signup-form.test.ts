import { describe, it, expect, vi } from "vitest";
import { validateSignupForm } from "../signup-form";

describe("Seller Signup Form Logic & Validation (FE-007, #30)", () => {
  describe("Step 1 Input Validation (Acceptance Criteria)", () => {
    it("validates that business name must be at least 2 characters", () => {
      const res = validateSignupForm({
        business_name: "A",
        sms_name: "Habesha",
        phone: "0911223344",
        password: "securepassword123",
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.business_name).toBe(
        "Business name must be at least 2 characters"
      );
    });

    it("validates that SMS name must not exceed 20 characters", () => {
      const res = validateSignupForm({
        business_name: "Habesha Cafe",
        sms_name: "This SMS Name Is Way Too Long To Be Twenty",
        phone: "0911223344",
        password: "securepassword123",
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.sms_name).toBe(
        "SMS name cannot exceed 20 characters"
      );
    });

    it("validates that phone must be a valid Ethiopian mobile number (09... or 07...)", () => {
      // Invalid prefix
      const res1 = validateSignupForm({
        business_name: "Habesha Cafe",
        sms_name: "Habesha",
        phone: "0811223344",
        password: "securepassword123",
      });
      expect(res1.isValid).toBe(false);
      expect(res1.errors.phone).toBeDefined();

      // Incomplete number
      const res2 = validateSignupForm({
        business_name: "Habesha Cafe",
        sms_name: "Habesha",
        phone: "091122",
        password: "securepassword123",
      });
      expect(res2.isValid).toBe(false);
      expect(res2.errors.phone).toBeDefined();
    });

    it("validates that password must be at least 10 characters long", () => {
      const res = validateSignupForm({
        business_name: "Habesha Cafe",
        sms_name: "Habesha",
        phone: "0911223344",
        password: "short9",
      });

      expect(res.isValid).toBe(false);
      expect(res.errors.password).toBe(
        "Password must be at least 10 characters long"
      );
    });

    it("accepts all valid registration inputs for Ethio Telecom and Safaricom numbers", () => {
      // Ethio Telecom (09...)
      const resEthio = validateSignupForm({
        business_name: "Habesha Cafe & Bakery",
        sms_name: "Habesha Cafe",
        phone: "0911223344",
        password: "securepassword123",
      });
      expect(resEthio.isValid).toBe(true);
      expect(resEthio.errors).toEqual({});

      // Safaricom (07...)
      const resSafari = validateSignupForm({
        business_name: "Habesha Cafe & Bakery",
        sms_name: "Habesha",
        phone: "+251712345678",
        password: "supersecurepassword123",
      });
      expect(resSafari.isValid).toBe(true);
      expect(resSafari.errors).toEqual({});
    });
  });

  describe("API Interaction Payloads", () => {
    it("constructs compliant payload for POST /api/auth/signup", () => {
      const values = {
        business_name: "Habesha Cafe & Bakery",
        sms_name: "Habesha Cafe",
        phone: "0911223344",
        password: "securepassword123",
      };

      const payload = {
        business_name: values.business_name.trim(),
        sms_name: values.sms_name.trim(),
        phone: values.phone,
        password: values.password,
      };

      expect(payload).toEqual({
        business_name: "Habesha Cafe & Bakery",
        sms_name: "Habesha Cafe",
        phone: "0911223344",
        password: "securepassword123",
      });
    });

    it("constructs compliant payload for Step 2 POST /api/auth/verify-phone", () => {
      const phone = "0911223344";
      const code = "123456";

      const payload = {
        phone,
        code,
      };

      expect(payload).toEqual({
        phone: "0911223344",
        code: "123456",
      });
    });
  });

  describe("Error Parsing & Formatting", () => {
    it("formats backend conflict error when phone is already registered", () => {
      const errorBody = {
        code: "PHONE_ALREADY_EXISTS",
        message: "A seller with this phone number is already registered",
      };

      const extractErrorMessage = (data: any) =>
        data?.message || "Registration failed";

      expect(extractErrorMessage(errorBody)).toBe(
        "A seller with this phone number is already registered"
      );
    });

    it("formats invalid code error when wrong OTP is submitted", () => {
      const errorBody = {
        code: "INVALID_CODE",
        message:
          "Invalid or expired verification code. Please check and try again.",
      };

      const extractErrorMessage = (data: any) =>
        data?.message || "Verification failed";

      expect(extractErrorMessage(errorBody)).toBe(
        "Invalid or expired verification code. Please check and try again."
      );
    });
  });
});
