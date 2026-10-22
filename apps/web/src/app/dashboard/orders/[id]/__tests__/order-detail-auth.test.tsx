import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

process.env.SESSION_SECRET = "test_session_secret_32_characters_long_minimum";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

const { redirectMock, notFoundMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  redirect: redirectMock,
  notFound: notFoundMock,
}));

const cookieStoreMock = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStoreMock),
}));

async function createTestToken(sellerId: string): Promise<string> {
  const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET!);
  return await new SignJWT({ sellerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

import OrderDetailPage from "../page";

describe("PR-002 (Issue #121): Order Detail Auth & IDOR Hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.get.mockReturnValue(undefined);
  });

  it("redirects unauthenticated requests to /login", async () => {
    cookieStoreMock.get.mockReturnValue(undefined);

    await OrderDetailPage({
      params: Promise.resolve({ id: "ord_victim_1" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("redirects users with forged or invalid token to /login", async () => {
    cookieStoreMock.get.mockReturnValue({ value: "invalid.forged.jwt" });

    await OrderDetailPage({
      params: Promise.resolve({ id: "ord_victim_1" }),
    });

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("calls notFound() when order does not exist in database (no mock fallback)", async () => {
    const token = await createTestToken("seller_123");
    cookieStoreMock.get.mockReturnValue({ value: token });
    prismaMock.order.findUnique.mockResolvedValue(null);

    await OrderDetailPage({
      params: Promise.resolve({ id: "non_existent_id" }),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("calls notFound() when order belongs to a different seller (IDOR prevention)", async () => {
    const token = await createTestToken("seller_attacker");
    cookieStoreMock.get.mockReturnValue({ value: token });

    // Order belongs to seller_victim
    prismaMock.order.findUnique.mockResolvedValue({
      id: "ord_victim_99",
      seller_id: "seller_victim",
      number: 1099,
      buyer_name: "Secret Customer",
      buyer_phone: "0911223344",
      state: "new",
      total_santim: 50000,
      order_items: [],
      order_events: [],
      messages: [],
      pickup_code: null,
    });

    await OrderDetailPage({
      params: Promise.resolve({ id: "ord_victim_99" }),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("renders order detail page when authenticated seller owns the order", async () => {
    const token = await createTestToken("seller_legit_owner");
    cookieStoreMock.get.mockReturnValue({ value: token });

    prismaMock.order.findUnique.mockResolvedValue({
      id: "ord_legit_1",
      seller_id: "seller_legit_owner",
      number: 1001,
      buyer_name: "Sara Hailu",
      buyer_phone: "0911223344",
      state: "accepted",
      total_santim: 40000,
      order_items: [],
      order_events: [],
      messages: [],
      pickup_code: null,
    });

    const element = await OrderDetailPage({
      params: Promise.resolve({ id: "ord_legit_1" }),
    });

    expect(element).toBeDefined();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
