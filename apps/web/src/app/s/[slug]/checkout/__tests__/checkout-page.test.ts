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
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import CheckoutPage from "../page";

describe("CheckoutPage (FE-002 - /s/[slug]/checkout)", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";
  });

  const demoSeller = {
    id: "seller-1",
    business_name: "Habesha Cafe & Bakery",
    sms_name: "Habesha Cafe",
    slug: "habesha-cafe",
  };

  const demoProducts = [
    {
      id: "prod-1",
      name: "Special Macchiato",
      price_santim: 4500,
      available: true,
      deleted_at: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers notFound() when seller slug does not exist", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(null);

    await expect(
      CheckoutPage({ params: Promise.resolve({ slug: "nonexistent" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalled();
  });

  it("queries seller and active products and renders CheckoutForm", async () => {
    prismaMock.seller.findUnique.mockResolvedValue(demoSeller);
    prismaMock.product.findMany.mockResolvedValue(demoProducts);

    const jsx = await CheckoutPage({
      params: Promise.resolve({ slug: "habesha-cafe" }),
    });

    expect(prismaMock.seller.findUnique).toHaveBeenCalledWith({
      where: { slug: "habesha-cafe" },
      select: {
        id: true,
        business_name: true,
        sms_name: true,
        slug: true,
        logo_url: true,
      },
    });

    expect(jsx).toBeDefined();
    expect(jsx.props.seller.slug).toBe("habesha-cafe");
    expect(jsx.props.seller.logoUrl).toBeNull();
    expect(jsx.props.products).toHaveLength(1);
    expect(jsx.props.products[0].name).toBe("Special Macchiato");
    expect(jsx.props.products[0].priceSantim).toBe(4500);
  });
});
