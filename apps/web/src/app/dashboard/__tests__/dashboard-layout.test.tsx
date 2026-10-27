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

import { renderToString } from "react-dom/server";
import { LanguageProvider } from "../../../lib/i18n";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import DashboardLayout from "../layout";

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

    // Render component to string with LanguageProvider
    const html = renderToString(<LanguageProvider>{jsx}</LanguageProvider>);
    expect(html).toContain('href="/s/habesha-coffee"');
    expect(html).not.toContain('href="/c/habesha-coffee"');
  });
});
