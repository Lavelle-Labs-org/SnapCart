import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      seller: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../lib/prisma", () => ({
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

import DashboardLayout from "../layout";

function findElements(node: any, predicate: (n: any) => boolean): any[] {
  const results: any[] = [];
  function traverse(current: any) {
    if (!current) return;
    if (predicate(current)) results.push(current);
    if (Array.isArray(current)) {
      current.forEach(traverse);
    } else if (current.props?.children) {
      traverse(current.props.children);
    }
  }
  traverse(node);
  return results;
}

describe("DashboardLayout Component (PR-009, Issue #128)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders View Storefront link pointing to /s/{slug} instead of broken /c/{slug}", async () => {
    const token = await createTestToken("seller-123");
    cookieStoreMock.get.mockReturnValue({ value: token });

    prismaMock.seller.findUnique.mockResolvedValue({
      id: "seller-123",
      business_name: "Habesha Coffee",
      slug: "habesha-coffee",
    });

    const jsx = await DashboardLayout({ children: <div>Child Content</div> });
    expect(jsx).toBeDefined();

    const links = findElements(jsx, (n) => n.type === "a" && n.props?.href?.includes("habesha-coffee"));
    expect(links.length).toBeGreaterThan(0);

    const storefrontLink = links[0];
    // This will fail on the unpatched code because href is '/c/habesha-coffee'
    expect(storefrontLink.props.href).toBe("/s/habesha-coffee");
  });
});
