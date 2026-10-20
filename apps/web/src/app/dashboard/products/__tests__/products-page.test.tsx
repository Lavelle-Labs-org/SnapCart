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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import ProductsPage from "../page";
import ProductManager from "../product-manager";

describe("ProductsPage (FE-011, Issue #34 - /dashboard/products)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Products Database Query & Mapping", () => {
    it("queries database and passes mapped product items to ProductManager", async () => {
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

      const element = await ProductsPage({});
      expect(element).toBeDefined();
      expect(element.type).toBe(ProductManager);

      // Verifies query filtered out soft-deleted items
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: { deleted_at: null },
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

    it("scopes query by authenticated sellerId when provided via searchParams", async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const element = await ProductsPage({
        searchParams: Promise.resolve({ sellerId: "seller_custom_99" }),
      });

      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: { seller_id: "seller_custom_99", deleted_at: null },
        orderBy: { created_at: "asc" },
      });

      expect(element.props.initialProducts).toEqual([]);
    });
  });

  describe("Empty State Initialization", () => {
    it("passes empty array to ProductManager when seller has 0 products", async () => {
      prismaMock.product.findMany.mockResolvedValue([]);

      const element = await ProductsPage({});
      expect(element).toBeDefined();
      expect(element.type).toBe(ProductManager);
      expect(element.props.initialProducts).toEqual([]);
    });
  });
});
