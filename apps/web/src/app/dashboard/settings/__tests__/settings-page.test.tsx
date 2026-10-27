import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      seller: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import { SignJWT } from "jose";

process.env.SESSION_SECRET = "test_session_secret_32_characters_long_minimum";

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

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: redirectMock,
}));

import SettingsPage from "../page";
import SettingsClient from "../settings-client";

describe("SettingsPage Server Component (FE-013, Issue #36)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.get.mockReturnValue(undefined);
  });

  it("loads seller profile from database by sellerId and passes initial values to SettingsClient", async () => {
    const mockSeller = {
      id: "seller-123",
      business_name: "Habesha Gourmet Bakery",
      sms_name: "Habesha Bakery",
      slug: "habesha-gourmet",
      phone: "+251911223344",
      created_at: new Date(),
    };
    prismaMock.seller.findUnique.mockResolvedValue(mockSeller);
    const token = await createTestToken("seller-123");
    cookieStoreMock.get.mockReturnValue({ value: token });

    const element = await SettingsPage({});

    expect(element).toBeDefined();
    expect(element.type).toBe(SettingsClient);

    const props = element.props;
    expect(props.initialSeller).toEqual({
      id: "seller-123",
      businessName: "Habesha Gourmet Bakery",
      smsName: "Habesha Bakery",
      slug: "habesha-gourmet",
      phone: "+251911223344",
      logoUrl: null,
    });
  });

  it("ignores spoofed searchParams.sellerId and uses authenticated cookie sellerId", async () => {
    const mockSeller = {
      id: "seller-authenticated",
      business_name: "Real Bakery",
      sms_name: "Real Bakery",
      slug: "real-bakery",
      phone: "+251911223344",
      created_at: new Date(),
    };
    prismaMock.seller.findUnique.mockResolvedValue(mockSeller);
    const token = await createTestToken("seller-authenticated");
    cookieStoreMock.get.mockReturnValue({ value: token });

    const element = await SettingsPage({
      searchParams: Promise.resolve({ sellerId: "seller-victim-idor" }),
    });

    expect(prismaMock.seller.findUnique).toHaveBeenCalledWith({
      where: { id: "seller-authenticated" },
    });
    expect(element.props.initialSeller.id).toBe("seller-authenticated");
  });

  it("redirects unauthenticated users to /login instead of falling back to hardcoded demo cafe", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(null);

    await SettingsPage({});

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("gracefully falls back when Prisma query fails for authenticated seller", async () => {
    prismaMock.seller.findUnique.mockRejectedValue(new Error("Database connection refused"));
    const token = await createTestToken("seller-resilient-1");
    cookieStoreMock.get.mockReturnValue({ value: token });

    const element = await SettingsPage({});

    expect(element).toBeDefined();
    expect(element.type).toBe(SettingsClient);
    expect(element.props.initialSeller.id).toBe("seller-resilient-1");
  });
});
