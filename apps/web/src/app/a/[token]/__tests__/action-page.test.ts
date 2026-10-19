import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockNotFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => {
    mockNotFound();
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Mock prisma
const mockFindUniqueActionToken = vi.fn();
vi.mock("../../../../lib/prisma", () => ({
  prisma: {
    actionToken: {
      findUnique: (...args: any[]) => mockFindUniqueActionToken(...args),
    },
  },
}));

import ActionPage from "../page";

describe("Seller Action Page (FE-005, #28)", () => {
  const validToken = "valid-token-123";

  const mockOrder = {
    id: "order-1",
    number: 1043,
    buyer_name: "Tadesse Gemechu",
    buyer_phone: "0911556677",
    sms_consent: true,
    state: "new",
    total_santim: 85000,
    created_at: new Date(),
    seller: {
      id: "seller-1",
      business_name: "Habesha Roastery",
      sms_name: "Habesha",
    },
    order_items: [
      {
        id: "item-1",
        name_at_order: "Special Coffee Blend",
        unit_price_santim: 85000,
        quantity: 1,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders friendly expired/invalid card with dashboard link when token does not exist", async () => {
    mockFindUniqueActionToken.mockResolvedValue(null);

    const result = await ActionPage({
      params: Promise.resolve({ token: "unknown-token" }),
    });

    expect(result).toBeDefined();
    expect(result.type).toBe("div");
    // Verify it renders the invalid view container
    expect(result.props.className).toContain("min-h-screen");
  });

  it("renders friendly expired card with dashboard link when token has expired (>48h)", async () => {
    mockFindUniqueActionToken.mockResolvedValue({
      id: "token-expired",
      purpose: "seller_action",
      expires_at: new Date(Date.now() - 3600000), // 1 hour past
      revoked_at: null,
      order: mockOrder,
    });

    const result = await ActionPage({
      params: Promise.resolve({ token: "expired-token" }),
    });

    expect(result).toBeDefined();
    expect(result.type).toBe("div");
    expect(result.props.className).toContain("min-h-screen");
  });

  it("renders SellerActionClient with authoritative order data when token is valid", async () => {
    mockFindUniqueActionToken.mockResolvedValue({
      id: "token-valid",
      purpose: "seller_action",
      expires_at: new Date(Date.now() + 86400000), // 24h future
      revoked_at: null,
      order: mockOrder,
    });

    const result = await ActionPage({
      params: Promise.resolve({ token: validToken }),
    });

    expect(result).toBeDefined();
    expect(result.props.token).toBe(validToken);
    expect(result.props.order.number).toBe(1043);
    expect(result.props.order.buyerName).toBe("Tadesse Gemechu");
    expect(result.props.order.state).toBe("new");
    expect(result.props.order.totalBirr).toBe(850);
  });
});
