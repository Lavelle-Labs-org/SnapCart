import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";
process.env.SESSION_SECRET = "test_session_secret_32_characters_long_minimum";

const { prismaMock, redirectMock } = vi.hoisted(() => ({
  prismaMock: {
    order: { findMany: vi.fn().mockResolvedValue([]) },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    seller: { findUnique: vi.fn().mockResolvedValue(null) },
    message: { findMany: vi.fn().mockResolvedValue([]) },
  },
  redirectMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock("../../lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock("../../../lib/prisma", () => ({ prisma: prismaMock, default: prismaMock }));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Mock cookies with no seller_session by default
const cookiesStoreMock = {
  get: vi.fn().mockReturnValue(undefined),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookiesStoreMock),
}));

import { extractSellerIdFromToken } from "../dashboard-helpers";
import OrdersDashboardPage from "../page";
import ProductsPage from "../products/page";
import SettingsPage from "../settings/page";
import MessagesLogPage from "../messages/page";

async function createToken(sellerId: string, secret: string, expiresIn = "7d"): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);
  return await new SignJWT({ sellerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
}

describe("PR-001 (Issue #120): Dashboard IDOR Prevention & Cryptographic JWT Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesStoreMock.get.mockReturnValue(undefined);
  });

  describe("extractSellerIdFromToken", () => {
    it("accepts validly signed JWT token with matching SESSION_SECRET", async () => {
      const token = await createToken("seller_valid_123", process.env.SESSION_SECRET!);
      const extracted = await extractSellerIdFromToken(token);
      expect(extracted).toBe("seller_valid_123");
    });

    it("rejects forged or unsigned JWT tokens", async () => {
      const payload = Buffer.from(JSON.stringify({ sellerId: "seller_attacker" })).toString("base64");
      const forgedToken = `eyJhbGciOiJIUzI1NiJ9.${payload}.unsigned_dummy_signature`;

      const extracted = await extractSellerIdFromToken(forgedToken);
      expect(extracted).toBeNull();
    });

    it("rejects token signed with wrong secret key", async () => {
      const wrongSecretToken = await createToken("seller_victim", "completely_wrong_secret_key_32_characters");
      const extracted = await extractSellerIdFromToken(wrongSecretToken);
      expect(extracted).toBeNull();
    });

    it("rejects expired JWT token", async () => {
      const expiredToken = await createToken("seller_expired", process.env.SESSION_SECRET!, "-10s");
      const extracted = await extractSellerIdFromToken(expiredToken);
      expect(extracted).toBeNull();
    });

    it("returns null for malformed or empty tokens", async () => {
      expect(await extractSellerIdFromToken("")).toBeNull();
      expect(await extractSellerIdFromToken("not.a.jwt")).toBeNull();
    });
  });

  describe("Dashboard Route IDOR Prevention (searchParams.sellerId ignored)", () => {
    it("OrdersDashboardPage redirects to /login when sellerId query param is provided without valid cookie", async () => {
      cookiesStoreMock.get.mockReturnValue(undefined);

      await OrdersDashboardPage({
        searchParams: Promise.resolve({ sellerId: "seller_victim_42" }),
      });

      expect(redirectMock).toHaveBeenCalledWith("/login");
    });

    it("ProductsPage redirects to /login when sellerId query param is provided without valid cookie", async () => {
      cookiesStoreMock.get.mockReturnValue(undefined);

      await ProductsPage({
        searchParams: Promise.resolve({ sellerId: "seller_victim_42" }),
      });

      expect(redirectMock).toHaveBeenCalledWith("/login");
    });

    it("SettingsPage redirects to /login when sellerId query param is provided without valid cookie", async () => {
      cookiesStoreMock.get.mockReturnValue(undefined);

      await SettingsPage({
        searchParams: Promise.resolve({ sellerId: "seller_victim_42" }),
      });

      expect(redirectMock).toHaveBeenCalledWith("/login");
    });

    it("MessagesLogPage redirects to /login when sellerId query param is provided without valid cookie", async () => {
      cookiesStoreMock.get.mockReturnValue(undefined);

      await MessagesLogPage({
        searchParams: Promise.resolve({ sellerId: "seller_victim_42" }),
      });

      expect(redirectMock).toHaveBeenCalledWith("/login");
    });
  });
});
