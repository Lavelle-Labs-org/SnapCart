import { describe, it, expect, vi } from "vitest";
import { seedDatabase } from "../../../prisma/seed";

describe("Database Seed Script (INFRA-003)", () => {
  it("idempotently seeds demo seller, products, and initial order", async () => {
    const mockSeller = {
      id: "mock-seller-uuid-1",
      business_name: "Habesha Cafe & Bakery",
      sms_name: "Habesha Cafe",
      slug: "habesha-cafe",
      phone: "0911223344",
    };

    const mockProducts: any[] = [];
    let orderCreated = false;

    const mockPrisma = {
      seller: {
        upsert: vi.fn().mockResolvedValue(mockSeller),
      },
      product: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          return mockProducts.find(
            (p) => p.seller_id === where.seller_id && p.name === where.name
          ) || null;
        }),
        create: vi.fn().mockImplementation(({ data }) => {
          const item = { id: `p-${mockProducts.length + 1}`, ...data };
          mockProducts.push(item);
          return item;
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const idx = mockProducts.findIndex((p) => p.id === where.id);
          if (idx >= 0) {
            mockProducts[idx] = { ...mockProducts[idx], ...data };
            return mockProducts[idx];
          }
          return data;
        }),
      },
      order: {
        findUnique: vi.fn().mockImplementation(() => {
          return orderCreated ? { id: "order-1001", number: 1001 } : null;
        }),
        create: vi.fn().mockImplementation(({ data }) => {
          orderCreated = true;
          return { id: "order-1001", ...data };
        }),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as any;

    // First run: creates rows
    const firstRun = await seedDatabase(mockPrisma);
    expect(firstRun.seller.slug).toBe("habesha-cafe");
    expect(firstRun.productsCount).toBe(3);
    expect(mockPrisma.seller.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(3);
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);

    // Second run: idempotent (updates/skips existing, does not duplicate)
    const secondRun = await seedDatabase(mockPrisma);
    expect(secondRun.seller.slug).toBe("habesha-cafe");
    expect(secondRun.productsCount).toBe(3);
    expect(mockPrisma.seller.upsert).toHaveBeenCalledTimes(2);
    // Should NOT create duplicate products or duplicate orders
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(3); // still 3
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1); // still 1
  });
});
