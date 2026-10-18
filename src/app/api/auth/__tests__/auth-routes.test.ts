import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST as signupHandler } from "../signup/route";
import { POST as verifyPhoneHandler } from "../verify-phone/route";
import { POST as loginHandler } from "../login/route";
import { POST as logoutHandler } from "../logout/route";
import { db } from "@/lib/db";
import { smshub } from "@/lib/smshub";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME } from "@/services/auth";

describe("Seller Auth & Phone Verification API Handlers (BE-005)", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "mock_session_secret_at_least_32_characters_long");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/signup", () => {
    const validSignupPayload = {
      business_name: "Habesha Roasters",
      sms_name: "Habesha",
      phone: "+251911223344",
      password: "securepassword123",
    };

    it("rejects invalid JSON with 400", async () => {
      const req = new Request("https://example.com/api/auth/signup", {
        method: "POST",
        body: "invalid-json",
      });

      const res = await signupHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_JSON");
    });

    it("validates input fields and rejects passwords shorter than 10 characters", async () => {
      const req = new Request("https://example.com/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validSignupPayload,
          password: "short", // < 10 chars
        }),
      });

      const res = await signupHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
      expect(data.error.message).toContain("10 characters");
    });

    it("rejects non-Ethiopian phone numbers with 400", async () => {
      const req = new Request("https://example.com/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validSignupPayload,
          phone: "+14155552671", // US number
        }),
      });

      const res = await signupHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_PHONE");
    });

    it("returns 409 Conflict if phone is already registered", async () => {
      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce({
        id: "existing-id",
        phone: "0911223344",
      } as any);

      const req = new Request("https://example.com/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSignupPayload),
      });

      const res = await signupHandler(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("PHONE_ALREADY_EXISTS");
    });

    it("dispatches OTP via Verify API, creates unverified seller and pending verification", async () => {
      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce(null); // phone check
      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce(null); // slug check

      vi.spyOn(smshub, "verifySend").mockResolvedValueOnce({
        status: "success",
        data: {
          verification_id: "ver_test_12345",
          expires_in: 300,
        },
      });

      const mockCreatedSeller = {
        id: "seller-uuid-new",
        business_name: "Habesha Roasters",
        sms_name: "Habesha",
        phone: "0911223344",
        slug: "habesha-roasters",
        phone_verified_at: null,
      };

      vi.spyOn(db.seller, "create").mockResolvedValueOnce(mockCreatedSeller as any);
      vi.spyOn(db.phoneVerification, "create").mockResolvedValueOnce({} as any);

      const req = new Request("https://example.com/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validSignupPayload),
      });

      const res = await signupHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.seller_id).toBe("seller-uuid-new");
      expect(json.data.phone).toBe("0911223344");
      expect(json.data.verification_id).toBe("ver_test_12345");
      expect(smshub.verifySend).toHaveBeenCalledWith("0911223344", "Habesha", 6, 300);
    });
  });

  describe("POST /api/auth/verify-phone", () => {
    it("rejects invalid code length with 400", async () => {
      const req = new Request("https://example.com/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          code: "123", // not 6 digits
        }),
      });

      const res = await verifyPhoneHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 if no pending verification exists", async () => {
      vi.spyOn(db.phoneVerification, "findFirst").mockResolvedValueOnce(null);

      const req = new Request("https://example.com/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          code: "123456",
        }),
      });

      const res = await verifyPhoneHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NO_PENDING_VERIFICATION");
    });

    it("returns 400 when SMSHub Verify Check rejects the code", async () => {
      vi.spyOn(db.phoneVerification, "findFirst").mockResolvedValueOnce({
        id: "pv-id-1",
        verification_id: "ver_test_12345",
        phone: "0911223344",
        status: "pending",
      } as any);

      vi.spyOn(smshub, "verifyCheck").mockResolvedValueOnce({
        status: "success",
        data: {
          valid: false,
          verification_status: "failed",
        },
      });

      const req = new Request("https://example.com/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          code: "999999",
        }),
      });

      const res = await verifyPhoneHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_CODE");
    });

    it("marks phone_verified_at, creates session cookie, and returns seller data on valid code", async () => {
      vi.spyOn(db.phoneVerification, "findFirst").mockResolvedValueOnce({
        id: "pv-id-1",
        verification_id: "ver_test_12345",
        phone: "0911223344",
        status: "pending",
      } as any);

      vi.spyOn(smshub, "verifyCheck").mockResolvedValueOnce({
        status: "success",
        data: {
          valid: true,
          verification_status: "approved",
        },
      });

      vi.spyOn(db.phoneVerification, "update").mockResolvedValueOnce({} as any);

      const verifiedDate = new Date();
      vi.spyOn(db.seller, "update").mockResolvedValueOnce({
        id: "seller-uuid-new",
        business_name: "Habesha Roasters",
        phone: "0911223344",
        slug: "habesha-roasters",
        phone_verified_at: verifiedDate,
      } as any);

      const req = new Request("https://example.com/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          code: "123456",
        }),
      });

      const res = await verifyPhoneHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.seller.id).toBe("seller-uuid-new");
      expect(data.data.seller.phone_verified_at).toBeDefined();

      // Verify session cookie was attached to response
      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toContain(SESSION_COOKIE_NAME);
      expect(setCookieHeader).toContain("HttpOnly");
      expect(setCookieHeader?.toLowerCase()).toContain("samesite=lax");
    });
  });

  describe("POST /api/auth/login", () => {
    it("rejects non-existent phone with 401 INVALID_CREDENTIALS", async () => {
      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce(null);

      const req = new Request("https://example.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          password: "password123",
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects wrong password with 401 INVALID_CREDENTIALS", async () => {
      const realHash = await hashPassword("correctpassword123");

      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce({
        id: "seller-1",
        phone: "0911223344",
        password_hash: realHash,
        phone_verified_at: new Date(),
      } as any);

      const req = new Request("https://example.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          password: "wrongpassword!",
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("rejects login with 403 PHONE_NOT_VERIFIED if phone is unverified", async () => {
      const realHash = await hashPassword("correctpassword123");

      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce({
        id: "seller-1",
        phone: "0911223344",
        password_hash: realHash,
        phone_verified_at: null, // Unverified
      } as any);

      const req = new Request("https://example.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "0911223344",
          password: "correctpassword123",
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("PHONE_NOT_VERIFIED");
    });

    it("authenticates seller and issues session cookie when credentials are valid", async () => {
      const realHash = await hashPassword("correctpassword123");

      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce({
        id: "seller-uuid-logged-in",
        business_name: "Habesha Roasters",
        phone: "0911223344",
        slug: "habesha-roasters",
        password_hash: realHash,
        phone_verified_at: new Date(),
      } as any);

      const req = new Request("https://example.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: "+251911223344", // normalized
          password: "correctpassword123",
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.seller.id).toBe("seller-uuid-logged-in");
      expect(data.data.seller.business_name).toBe("Habesha Roasters");

      // Verify session cookie was set
      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toContain(SESSION_COOKIE_NAME);
      expect(setCookieHeader).toContain("HttpOnly");
      expect(setCookieHeader?.toLowerCase()).toContain("samesite=lax");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears the session cookie with maxAge=0", async () => {
      const res = await logoutHandler();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe("Logged out successfully");

      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toContain(SESSION_COOKIE_NAME);
      expect(setCookieHeader).toContain("Max-Age=0");
    });
  });
});
