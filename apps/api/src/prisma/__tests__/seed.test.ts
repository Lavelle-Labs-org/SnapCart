import { describe, it, expect, vi, afterEach } from "vitest";
import { seedDatabase, DEMO_SELLER, DEMO_PRODUCTS } from "../../../../../prisma/seed";

describe("Database Seed Script Production Safety & Idempotency (INFRA-003)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("strictly blocks seedDatabase from running in production before any database calls", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const mockPrisma = {
      seller: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $disconnect: vi.fn(),
    } as any;

    await expect(seedDatabase(mockPrisma)).rejects.toThrowError(
      /Production safety guard: Database seeding is strictly forbidden in production environments/
    );

    // Verify zero database queries were executed
    expect(mockPrisma.seller.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.seller.create).not.toHaveBeenCalled();
    expect(mockPrisma.product.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
  });

  it("never overwrites an existing seller's phone or verification status", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const existingCustomSeller = {
      id: "seller-custom-123",
      business_name: "Habesha Cafe & Bakery",
      sms_name: "Habesha Cafe",
      slug: "habesha-cafe",
      phone: "0988776655", // custom non-demo phone
      phone_verified_at: null, // unverified or custom status
      password_hash: "custom_existing_password_hash",
    };

    const mockProducts: any[] = [];

    const mockPrisma = {
      seller: {
        findUnique: vi.fn().mockResolvedValue(existingCustomSeller),
        create: vi.fn(),
        update: vi.fn(),
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
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({ id: "order-1001", number: 1001 }),
        create: vi.fn(),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as any;

    const result = await seedDatabase(mockPrisma);

    // Seller create must not be called since seller already exists
    expect(mockPrisma.seller.create).not.toHaveBeenCalled();
    // Seller update must not overwrite phone or verification status
    expect(mockPrisma.seller.update).not.toHaveBeenCalled();

    // The preserved seller retains original phone and verification status
    expect(result.seller.phone).toBe("0988776655");
    expect(result.seller.phone_verified_at).toBeNull();
    expect(result.seller.password_hash).toBe("custom_existing_password_hash");
  });

  it("creates verified demo seller and products when database is empty", async () => {
    vi.stubEnv("NODE_ENV", "test");

    let storedSeller: any = null;
    const storedProducts: any[] = [];
    let storedOrder: any = null;

    const mockPrisma = {
      seller: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve(storedSeller)),
        create: vi.fn().mockImplementation(({ data }) => {
          storedSeller = { id: "new-seller-1", ...data };
          return Promise.resolve(storedSeller);
        }),
      },
      product: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          return storedProducts.find(
            (p) => p.seller_id === where.seller_id && p.name === where.name
          ) || null;
        }),
        create: vi.fn().mockImplementation(({ data }) => {
          const item = { id: `p-${storedProducts.length + 1}`, ...data };
          storedProducts.push(item);
          return Promise.resolve(item);
        }),
        update: vi.fn(),
      },
      order: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve(storedOrder)),
        create: vi.fn().mockImplementation(({ data }) => {
          storedOrder = { id: "order-1001", ...data };
          return Promise.resolve(storedOrder);
        }),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Run 1: seeds seller, 3 products, and order 1001
    const run1 = await seedDatabase(mockPrisma);
    expect(run1.seller.slug).toBe(DEMO_SELLER.slug);
    expect(run1.seller.phone).toBe(DEMO_SELLER.phone);
    expect(run1.seller.phone_verified_at).toBeInstanceOf(Date);
    expect(run1.productsCount).toBe(DEMO_PRODUCTS.length);
    expect(mockPrisma.seller.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(3);
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1);

    // Run 2: idempotent execution - does not duplicate seller, products, or order
    const run2 = await seedDatabase(mockPrisma);
    expect(run2.seller.slug).toBe(DEMO_SELLER.slug);
    expect(mockPrisma.seller.create).toHaveBeenCalledTimes(1); // Still 1
    expect(mockPrisma.product.create).toHaveBeenCalledTimes(3); // Still 3
    expect(mockPrisma.order.create).toHaveBeenCalledTimes(1); // Still 1
  });
});
