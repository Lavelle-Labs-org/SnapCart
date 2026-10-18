import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import { ProductsService } from "../products.service";

describe("ProductsService (BE-006)", () => {
  let service: ProductsService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    service = new ProductsService(prismaMock);
  });

  describe("getProductsBySeller", () => {
    it("returns all non-deleted products for the authenticated seller", async () => {
      const mockDate = new Date("2026-10-18T10:00:00.000Z");
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          seller_id: "seller-123",
          name: "Injera Combo",
          price_santim: 35000,
          available: true,
          created_at: mockDate,
          deleted_at: null,
        },
      ]);

      const result = await service.getProductsBySeller("seller-123");
      expect(prismaMock.product.findMany).toHaveBeenCalledWith({
        where: {
          seller_id: "seller-123",
          deleted_at: null,
        },
        orderBy: { created_at: "asc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("prod-1");
      expect(result[0].priceSantim).toBe(35000);
      expect(result[0].price_santim).toBe(35000);
    });
  });

  describe("createProduct", () => {
    it("successfully creates product with price_santim", async () => {
      const mockDate = new Date("2026-10-18T10:00:00.000Z");
      prismaMock.product.create.mockResolvedValue({
        id: "prod-new",
        seller_id: "seller-123",
        name: "Special Shiro",
        price_santim: 15000,
        available: true,
        created_at: mockDate,
        deleted_at: null,
      });

      const res = await service.createProduct("seller-123", {
        name: "Special Shiro",
        priceSantim: 15000,
      });

      expect(prismaMock.product.create).toHaveBeenCalledWith({
        data: {
          seller_id: "seller-123",
          name: "Special Shiro",
          price_santim: 15000,
          available: true,
        },
      });
      expect(res.id).toBe("prod-new");
      expect(res.name).toBe("Special Shiro");
      expect(res.priceSantim).toBe(15000);
    });

    it("rejects non-positive price", async () => {
      await expect(
        service.createProduct("seller-123", {
          name: "Free Item",
          priceSantim: 0,
        })
      ).rejects.toThrow(HttpException);

      await expect(
        service.createProduct("seller-123", {
          name: "Negative Item",
          priceSantim: -100,
        })
      ).rejects.toThrow(HttpException);
    });

    it("rejects empty or whitespace-only name", async () => {
      await expect(
        service.createProduct("seller-123", {
          name: "   ",
          priceSantim: 2500,
        })
      ).rejects.toThrow(HttpException);
    });
  });

  describe("updateProduct", () => {
    const existingProduct = {
      id: "prod-1",
      seller_id: "seller-123",
      name: "Old Name",
      price_santim: 2000,
      available: true,
      created_at: new Date("2026-10-18T10:00:00.000Z"),
      deleted_at: null,
    };

    it("successfully updates name, price, and availability for owner", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existingProduct);
      prismaMock.product.update.mockResolvedValue({
        ...existingProduct,
        name: "Updated Name",
        price_santim: 2500,
        available: false,
      });

      const res = await service.updateProduct("seller-123", "prod-1", {
        name: "Updated Name",
        priceSantim: 2500,
        available: false,
      });

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: {
          name: "Updated Name",
          price_santim: 2500,
          available: false,
        },
      });
      expect(res.name).toBe("Updated Name");
      expect(res.priceSantim).toBe(2500);
      expect(res.available).toBe(false);
    });

    it("throws 403 Forbidden when attempting to edit another seller's product", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existingProduct);

      await expect(
        service.updateProduct("different-seller", "prod-1", {
          name: "Malicious Edit",
        })
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });

    it("throws 404 Not Found when product does not exist", async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProduct("seller-123", "non-existent", {
          name: "Test",
        })
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("throws 404 Not Found when product is already soft-deleted", async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        ...existingProduct,
        deleted_at: new Date(),
      });

      await expect(
        service.updateProduct("seller-123", "prod-1", {
          name: "Test",
        })
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("rejects non-positive price on update", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existingProduct);

      await expect(
        service.updateProduct("seller-123", "prod-1", {
          priceSantim: -50,
        })
      ).rejects.toThrow(HttpException);
    });
  });

  describe("deleteProduct (soft delete)", () => {
    const existingProduct = {
      id: "prod-1",
      seller_id: "seller-123",
      name: "Product to Delete",
      price_santim: 2000,
      available: true,
      created_at: new Date("2026-10-18T10:00:00.000Z"),
      deleted_at: null,
    };

    it("marks deleted_at timestamp when deleted by owner", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existingProduct);
      prismaMock.product.update.mockResolvedValue({
        ...existingProduct,
        deleted_at: new Date(),
      });

      const res = await service.deleteProduct("seller-123", "prod-1");
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: "prod-1" },
        data: { deleted_at: expect.any(Date) },
      });
      expect(res).toEqual({ deleted: true, id: "prod-1" });
    });

    it("throws 403 Forbidden when attempting to delete another seller's product", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existingProduct);

      await expect(
        service.deleteProduct("intruder-seller", "prod-1")
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });

    it("throws 404 Not Found if product does not exist or already soft-deleted", async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteProduct("seller-123", "non-existent")
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });

      prismaMock.product.findUnique.mockResolvedValue({
        ...existingProduct,
        deleted_at: new Date(),
      });

      await expect(
        service.deleteProduct("seller-123", "prod-1")
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });
});
