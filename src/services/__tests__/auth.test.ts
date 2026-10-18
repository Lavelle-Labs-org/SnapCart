import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  createSessionCookie,
  createClearSessionCookie,
  requireSeller,
  getSession,
  extractTokenFromRequest,
  AuthError,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/services/auth";
import { db } from "@/lib/db";
import { SignJWT } from "jose";

describe("Seller Authentication & Session Management Service (BE-004)", () => {
  const TEST_SECRET = "super_secret_session_key_at_least_32_characters_long!";
  const TEST_SELLER_ID = "seller-uuid-1234-5678";

  afterEach(() => {
    // Restore all spies and mocks cleanly after each test
    vi.restoreAllMocks();
  });

  describe("Cookie Configuration", () => {
    it("creates cookie with HttpOnly, SameSite=Lax, and 7-day maxAge", () => {
      const cookie = createSessionCookie("mock_jwt_token", { isProduction: false });

      expect(cookie.name).toBe(SESSION_COOKIE_NAME);
      expect(cookie.value).toBe("mock_jwt_token");
      expect(cookie.httpOnly).toBe(true);
      expect(cookie.sameSite).toBe("lax");
      expect(cookie.path).toBe("/");
      expect(cookie.maxAge).toBe(SESSION_DURATION_SECONDS);
      expect(cookie.secure).toBe(false);
    });

    it("enforces Secure flag when in production mode", () => {
      const prodCookie = createSessionCookie("mock_jwt_token", { isProduction: true });
      expect(prodCookie.secure).toBe(true);
    });

    it("creates clear session cookie with maxAge=0", () => {
      const clearCookie = createClearSessionCookie();
      expect(clearCookie.name).toBe(SESSION_COOKIE_NAME);
      expect(clearCookie.value).toBe("");
      expect(clearCookie.maxAge).toBe(0);
      expect(clearCookie.httpOnly).toBe(true);
      expect(clearCookie.sameSite).toBe("lax");
    });
  });

  describe("Token Signing & Verification", () => {
    it("signs and decodes valid session token containing only minimal sellerId claim", async () => {
      const token = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );

      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3); // Standard JWT format

      const decoded = await verifySessionToken(token, { secret: TEST_SECRET });
      expect(decoded.sellerId).toBe(TEST_SELLER_ID);
      // Confirms phone and slug are NOT stored in the token claims
      expect((decoded as any).phone).toBeUndefined();
      expect((decoded as any).slug).toBeUndefined();
    });

    it("rejects expired sessions with 401 AuthError", async () => {
      const expiredToken = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET, expiresIn: "-1s" } // expired 1s ago
      );

      let thrownError: any = null;
      try {
        await verifySessionToken(expiredToken, { secret: TEST_SECRET });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AuthError);
      expect(thrownError.status).toBe(401);
      expect(thrownError.code).toBe("SESSION_EXPIRED");
      expect(thrownError.message).toContain("expired");
    });

    it("rejects tokens with invalid signature", async () => {
      const token = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );

      const DIFFERENT_SECRET = "different_secret_key_that_is_at_least_32_chars_long!";

      await expect(
        verifySessionToken(token, { secret: DIFFERENT_SECRET })
      ).rejects.toThrow(AuthError);
    });

    it("rejects malformed or empty tokens", async () => {
      await expect(verifySessionToken("", { secret: TEST_SECRET })).rejects.toThrow(AuthError);
      await expect(verifySessionToken("not-a-jwt", { secret: TEST_SECRET })).rejects.toThrow(AuthError);
    });
  });

  describe("Seller ID Validation & Non-Empty Checks", () => {
    it("refuses to create token with empty or whitespace sellerId", async () => {
      await expect(
        createSessionToken({ sellerId: "" }, { secret: TEST_SECRET })
      ).rejects.toThrow(AuthError);

      await expect(
        createSessionToken({ sellerId: "   " }, { secret: TEST_SECRET })
      ).rejects.toThrow(AuthError);

      await expect(
        createSessionToken({ sellerId: null as any }, { secret: TEST_SECRET })
      ).rejects.toThrow(AuthError);
    });

    it("rejects verified tokens with missing or empty sellerId claim", async () => {
      const secretKey = new TextEncoder().encode(TEST_SECRET);

      // Forge a token with empty sellerId
      const emptyIdToken = await new SignJWT({ sellerId: "" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secretKey);

      await expect(
        verifySessionToken(emptyIdToken, { secret: TEST_SECRET })
      ).rejects.toThrowError(/missing valid non-empty sellerId/);

      // Forge a token with whitespace-only sellerId
      const whitespaceIdToken = await new SignJWT({ sellerId: "   " })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secretKey);

      await expect(
        verifySessionToken(whitespaceIdToken, { secret: TEST_SECRET })
      ).rejects.toThrowError(/missing valid non-empty sellerId/);

      // Forge a token with non-string sellerId (e.g. number)
      const numberIdToken = await new SignJWT({ sellerId: 12345 })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secretKey);

      await expect(
        verifySessionToken(numberIdToken, { secret: TEST_SECRET })
      ).rejects.toThrowError(/missing valid non-empty sellerId/);
    });
  });

  describe("extractTokenFromRequest", () => {
    it("extracts token from NextRequest cookies", () => {
      const mockReq = {
        cookies: {
          get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: "token_from_cookies" } : undefined),
        },
        headers: new Headers(),
      } as any;

      expect(extractTokenFromRequest(mockReq)).toBe("token_from_cookies");
    });

    it("extracts token from standard Cookie header", () => {
      const headers = new Headers();
      headers.set("cookie", `other_cookie=123; ${SESSION_COOKIE_NAME}=token_from_header; test=456`);
      const mockReq = new Request("https://example.com/api/test", { headers });

      expect(extractTokenFromRequest(mockReq)).toBe("token_from_header");
    });

    it("extracts token from Authorization Bearer header", () => {
      const headers = new Headers();
      headers.set("authorization", "Bearer token_from_bearer");
      const mockReq = new Request("https://example.com/api/test", { headers });

      expect(extractTokenFromRequest(mockReq)).toBe("token_from_bearer");
    });

    it("returns null when no token is present", () => {
      const mockReq = new Request("https://example.com/api/test");
      expect(extractTokenFromRequest(mockReq)).toBeNull();
    });
  });

  describe("requireSeller Authorization Guard", () => {
    it("throws 401 if unauthenticated (no token provided)", async () => {
      const req = new Request("https://example.com/api/dashboard");

      let thrownError: any = null;
      try {
        await requireSeller(req, { secret: TEST_SECRET });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AuthError);
      expect(thrownError.status).toBe(401);
      expect(thrownError.message).toContain("Missing session token");
    });

    it("throws 401 if session token is expired", async () => {
      const expiredToken = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET, expiresIn: "-10s" }
      );

      const headers = new Headers();
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${expiredToken}`);
      const req = new Request("https://example.com/api/dashboard", { headers });

      let thrownError: any = null;
      try {
        await requireSeller(req, { secret: TEST_SECRET });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AuthError);
      expect(thrownError.status).toBe(401);
      expect(thrownError.code).toBe("SESSION_EXPIRED");
    });

    it("returns authenticated sellerId when token is valid", async () => {
      const validToken = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );

      const headers = new Headers();
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${validToken}`);
      const req = new Request("https://example.com/api/dashboard", { headers });

      const auth = await requireSeller(req, { secret: TEST_SECRET });
      expect(auth.sellerId).toBe(TEST_SELLER_ID);
    });

    it("resolves current seller details from database when fetchSeller is true", async () => {
      const validToken = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );

      const mockSeller = {
        id: TEST_SELLER_ID,
        business_name: "Habesha Cafe & Bakery",
        phone: "0911223344",
        slug: "habesha-cafe",
        sms_name: "Habesha Cafe",
        password_hash: "mock_hash",
        created_at: new Date(),
        phone_verified_at: new Date(),
      };

      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce(mockSeller as any);

      const headers = new Headers();
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${validToken}`);
      const req = new Request("https://example.com/api/dashboard", { headers });

      const auth = await requireSeller(req, { secret: TEST_SECRET, fetchSeller: true });
      expect(auth.sellerId).toBe(TEST_SELLER_ID);
      expect(auth.seller?.business_name).toBe("Habesha Cafe & Bakery");
      expect(auth.seller?.slug).toBe("habesha-cafe");
      expect(auth.phone).toBe("0911223344");
      expect(auth.slug).toBe("habesha-cafe");
    });

    it("throws 401 when fetchSeller is true but seller is missing from database", async () => {
      const validToken = await createSessionToken(
        { sellerId: "deleted-seller-uuid" },
        { secret: TEST_SECRET }
      );

      vi.spyOn(db.seller, "findUnique").mockResolvedValueOnce(null);

      const headers = new Headers();
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${validToken}`);
      const req = new Request("https://example.com/api/dashboard", { headers });

      let thrownError: any = null;
      try {
        await requireSeller(req, { secret: TEST_SECRET, fetchSeller: true });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(AuthError);
      expect(thrownError.status).toBe(401);
      expect(thrownError.code).toBe("SELLER_NOT_FOUND");
      expect(thrownError.message).toContain("Seller account not found");
    });
  });

  describe("getSession Safe Helper", () => {
    it("returns null instead of throwing when unauthenticated", async () => {
      const req = new Request("https://example.com/api/public");
      const session = await getSession(req, { secret: TEST_SECRET });
      expect(session).toBeNull();
    });

    it("returns session payload when valid token is present", async () => {
      const token = await createSessionToken(
        { sellerId: TEST_SELLER_ID },
        { secret: TEST_SECRET }
      );

      const headers = new Headers();
      headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
      const req = new Request("https://example.com/api/public", { headers });

      const session = await getSession(req, { secret: TEST_SECRET });
      expect(session?.sellerId).toBe(TEST_SELLER_ID);
    });
  });
});
