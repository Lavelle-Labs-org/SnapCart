import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      product: {
        findMany: vi.fn(),
      },
    },
  };
});

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

vi.mock("@/lib/prisma", () => ({
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

import ProductsPage from "../page";
import ProductManager from "../product-manager";

describe("ProductsPage (FE-011, Issue #34 - /dashboard/products)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.get.mockReturnValue(undefined);
  });

  describe("Products Database Query & Mapping", () => {
    it("queries database and passes mapped product items to ProductManager for authenticated seller", async () => {
      const mockProducts = [
        {
          id: "prod_1",
          name: "Special Combo Platter",
          price_santim: 35000,
          available: true,
          created_at: new Date(),
          deleted_at: null,
        },
        {
          id: "prod_2",
          name: "Traditional Spiced Tea",
          price_santim: 5000,
          available: true,
          created_at: new Date(),
          deleted_at: null,
        },
        {
          id: "prod_3",
          name: "Fresh Roasted Coffee (1kg)",
          price_santim: 60000,
          available: false,
          created_at: new Date(),
          deleted_at: null,
        },
      ];

      prismaMock.product.findMany.mockResolvedValue(mockProducts);
      const token = await createTestToken("seller_test_1");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const element = await ProductsPage({});
      expect(element).toBeDefined();
      expect(element.type).toBe(ProductManager);

      // Verifies query scoped to authenticated seller and filtered out soft-deleted items
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: { seller_id: "seller_test_1", deleted_at: null },
        orderBy: { created_at: "asc" },
      });

      const initialProducts = element.props.initialProducts;
      expect(initialProducts).toHaveLength(3);

      expect(initialProducts[0]).toEqual({
        id: "prod_1",
        name: "Special Combo Platter",
        priceSantim: 35000,
        available: true,
      });

      expect(initialProducts[1]).toEqual({
        id: "prod_2",
        name: "Traditional Spiced Tea",
        priceSantim: 5000,
        available: true,
      });

      expect(initialProducts[2]).toEqual({
        id: "prod_3",
        name: "Fresh Roasted Coffee (1kg)",
        priceSantim: 60000,
        available: false,
      });
    });

    it("scopes query by authenticated sellerId from cookie and ignores searchParams.sellerId", async () => {
      prismaMock.product.findMany.mockResolvedValue([]);
      const token = await createTestToken("seller_custom_99");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const element = await ProductsPage({
        searchParams: Promise.resolve({ sellerId: "seller_malicious_spoof" }),
      });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: { seller_id: "seller_custom_99", deleted_at: null },
        orderBy: { created_at: "asc" },
      });

      expect(element.props.initialProducts).toEqual([]);
    });
  });

  describe("Authentication Enforcement", () => {
    it("redirects unauthenticated users to /login", async () => {
      await ProductsPage({});
      expect(redirectMock).toHaveBeenCalledWith("/login");
    });
  });

  describe("Empty State Initialization", () => {
    it("passes empty array to ProductManager when seller has 0 products", async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const element = await ProductsPage({
        searchParams: Promise.resolve({ sellerId: "seller_test_empty" }),
      });
      expect(element).toBeDefined();
      expect(element.type).toBe(ProductManager);
      expect(element.props.initialProducts).toEqual([]);
    });
  });
});
