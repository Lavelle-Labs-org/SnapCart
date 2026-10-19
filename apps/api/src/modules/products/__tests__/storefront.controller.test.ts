import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { StorefrontController } from "../storefront.controller";

describe("StorefrontController (FE-001 / BE-006)", () => {
  let controller: StorefrontController;
  let prismaMock: any;

  const demoSeller = {
    id: "seller-1",
    business_name: "Habesha Cafe & Bakery",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    slug: "habesha-cafe",
    created_at: new Date("2026-10-18T10:00:00Z"),
  };

  const demoProducts = [
    {
      id: "prod-1",
      seller_id: "seller-1",
      name: "Special Macchiato",
      price_santim: 4500,
      available: true,
      deleted_at: null,
      created_at: new Date("2026-10-18T10:00:00Z"),
    },
    {
      id: "prod-2",
      seller_id: "seller-1",
      name: "Fresh Croissant",
      price_santim: 3500,
      available: true,
      deleted_at: null,
      created_at: new Date("2026-10-18T10:05:00Z"),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock = {
      seller: {
        findUnique: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
    };

    controller = new StorefrontController(prismaMock);
  });

  it("returns 404 NotFoundException when seller slug does not exist", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(null);

    await expect(controller.getStorefront("unknown-shop")).rejects.toThrow(
      NotFoundException
    );
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
  });

  it("returns seller details and active products (available: true, deleted_at: null)", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(demoSeller);
    prismaMock.product.findMany.mockResolvedValue(demoProducts);

    const result = await controller.getStorefront("habesha-cafe");

    expect(result).toBeDefined();
    expect(result.seller.slug).toBe("habesha-cafe");
    expect(result.seller.businessName).toBe("Habesha Cafe & Bakery");
    expect(result.products).toHaveLength(2);
    expect(result.products[0].name).toBe("Special Macchiato");
    expect(result.products[0].priceSantim).toBe(4500);

    expect(prismaMock.product.findMany).toHaveBeenCalledWith({
      where: {
        seller_id: "seller-1",
        available: true,
        deleted_at: null,
      },
      orderBy: { created_at: "asc" },
    });
  });

  it("returns empty product list when seller has no active products", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(demoSeller);
    prismaMock.product.findMany.mockResolvedValue([]);

    const result = await controller.getStorefront("habesha-cafe");

    expect(result.seller.slug).toBe("habesha-cafe");
    expect(result.products).toEqual([]);
  });
});
