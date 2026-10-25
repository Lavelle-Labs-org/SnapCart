import { describe, it, expect } from "vitest";
import {
  signBuyerToken,
  verifyBuyerToken,
  createBuyerSessionCookie,
  extractBuyerTokenFromRequest,
  BUYER_SESSION_COOKIE,
  BUYER_SESSION_DURATION_SECONDS,
} from "../buyer-auth";

describe("Buyer Auth & Session Management", () => {
  const secret = "test_super_secret_buyer_session_key_at_least_32_chars";
  const payload = {
    customerId: "cust-uuid-123",
    phone: "0911223344",
    name: "Abebe Bikila",
  };

  it("signs and successfully verifies a buyer session token", async () => {
    const token = await signBuyerToken(payload, secret);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);

    const decoded = await verifyBuyerToken(token, secret);
    expect(decoded).not.toBeNull();
    expect(decoded?.customerId).toBe(payload.customerId);
    expect(decoded?.phone).toBe(payload.phone);
    expect(decoded?.name).toBe(payload.name);
    expect(decoded?.exp).toBeDefined();
  });

  it("rejects invalid, empty, or tampered tokens", async () => {
    expect(await verifyBuyerToken("", secret)).toBeNull();
    expect(await verifyBuyerToken("invalid.jwt.token", secret)).toBeNull();

    const token = await signBuyerToken(payload, secret);
    const tampered = token.slice(0, -5) + "abcde";
    expect(await verifyBuyerToken(tampered, secret)).toBeNull();

    const differentSecret = "another_secret_key_that_is_different_32_chars";
    expect(await verifyBuyerToken(token, differentSecret)).toBeNull();
  });

  it("creates a secure HttpOnly cookie for buyer session", () => {
    const cookie = createBuyerSessionCookie("mock_token", { isProduction: false });
    expect(cookie.name).toBe(BUYER_SESSION_COOKIE);
    expect(cookie.value).toBe("mock_token");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
    expect(cookie.maxAge).toBe(BUYER_SESSION_DURATION_SECONDS);
    expect(cookie.secure).toBe(false);

    const prodCookie = createBuyerSessionCookie("mock_token", { isProduction: true });
    expect(prodCookie.secure).toBe(true);
  });

  it("extracts buyer token from req.cookies, Cookie header, or Authorization header", () => {
    // 1. req.cookies
    expect(
      extractBuyerTokenFromRequest({
        cookies: { [BUYER_SESSION_COOKIE]: "cookie_token_123" },
      })
    ).toBe("cookie_token_123");

    // 2. Cookie header
    expect(
      extractBuyerTokenFromRequest({
        headers: {
          cookie: `foo=bar; ${BUYER_SESSION_COOKIE}=header_token_456; baz=qux`,
        },
      })
    ).toBe("header_token_456");

    // 3. Authorization Bearer header
    expect(
      extractBuyerTokenFromRequest({
        headers: {
          authorization: "Bearer bearer_token_789",
        },
      })
    ).toBe("bearer_token_789");

    // 4. Missing
    expect(extractBuyerTokenFromRequest({})).toBeNull();
    expect(extractBuyerTokenFromRequest(null)).toBeNull();
  });
});
