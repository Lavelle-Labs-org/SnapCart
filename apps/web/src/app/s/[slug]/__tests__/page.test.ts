import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

const { notFoundMock, prismaMock } = vi.hoisted(() => {
  return {
    notFoundMock: vi.fn(() => {
      const error: any = new Error("NEXT_NOT_FOUND");
      error.digest = "NEXT_NOT_FOUND";
      throw error;
    }),
    prismaMock: {
      seller: {
        findUnique: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

// Import StorefrontPage after mocks
import StorefrontPage from "../page";

describe("StorefrontPage (FE-001 - /s/[slug])", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";
  });
  const dbSeller = {
    id: "seller-1",
    business_name: "Bole Bakery & Sweets",
    sms_name: "Bole Bakery",
    slug: "bole-bakery",
  };

  const dbProducts = [
    {
      id: "prod-1",
      name: "Special Macchiato",
      price_santim: 4500,
      image_url: null,
      available: true,
      deleted_at: null,
    },
    {
      id: "prod-2",
      name: "Traditional Doro Wat",
      price_santim: 35000,
      image_url: "https://example.com/doro.jpg",
      available: true,
      deleted_at: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves demo storefront directly without any database connection for habesha-cafe", async () => {
    const jsx = await StorefrontPage({
      params: Promise.resolve({ slug: "habesha-cafe" }),
    });

    expect(prismaMock.seller.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.product.findMany).not.toHaveBeenCalled();
    expect(jsx).toBeDefined();
    expect(jsx.props.seller.slug).toBe("habesha-cafe");
    expect(jsx.props.seller.businessName).toBe("Habesha Cafe & Bakery");
    expect(jsx.props.products.length).toBeGreaterThan(0);
  });

  it("triggers notFound() when seller slug does not exist", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(null);

    await expect(
      StorefrontPage({ params: Promise.resolve({ slug: "unknown-store" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("queries seller and only available products from database", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(dbSeller);
    prismaMock.product.findMany.mockResolvedValue(dbProducts);

    const jsx = await StorefrontPage({
      params: Promise.resolve({ slug: "bole-bakery" }),
    });

    expect(prismaMock.seller.findUnique).toHaveBeenCalledWith({
      where: { slug: "bole-bakery" },
      select: {
        id: true,
        business_name: true,
        sms_name: true,
        slug: true,
        logo_url: true,
      },
    });

    expect(prismaMock.product.findMany).toHaveBeenCalledWith({
      where: {
        seller_id: "seller-1",
        available: true,
        deleted_at: null,
      },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        name: true,
        price_santim: true,
        image_url: true,
        available: true,
      },
    });

    expect(jsx).toBeDefined();
    expect(jsx.props.seller.slug).toBe("bole-bakery");
    expect(jsx.props.seller.businessName).toBe("Bole Bakery & Sweets");
    expect(jsx.props.seller.logoUrl).toBeNull();
    expect(jsx.props.products).toHaveLength(2);
    expect(jsx.props.products[0].name).toBe("Special Macchiato");
    expect(jsx.props.products[0].priceSantim).toBe(4500);
    expect(jsx.props.products[1].name).toBe("Traditional Doro Wat");
    expect(jsx.props.products[1].priceSantim).toBe(35000);
  });

  it("handles seller with 0 active products cleanly", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(dbSeller);
    prismaMock.product.findMany.mockResolvedValue([]);

    const jsx = await StorefrontPage({
      params: Promise.resolve({ slug: "bole-bakery" }),
    });

    expect(jsx).toBeDefined();
    expect(jsx.props.products).toHaveLength(0);
  });
});
