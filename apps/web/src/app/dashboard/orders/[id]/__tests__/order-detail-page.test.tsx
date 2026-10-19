import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      order: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import OrderDetailPage from "../page";

// Helper to recursively extract all text content from JSX tree
function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (node.props?.children) return extractText(node.props.children);
  return "";
}

describe("OrderDetailPage (CLEANUP-001 - /dashboard/orders/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acceptance criterion: navigating to /dashboard/orders/ord_123 renders layout without 404 error", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null);

    // Call page server component with arbitrary order ID
    const element = await OrderDetailPage({
      params: Promise.resolve({ id: "ord_123" }),
    });

    expect(element).toBeDefined();
    expect(element.type).toBe("div");

    const text = extractText(element);
    expect(text).toContain("Order #");
    expect(text).toContain("ord_123");
    expect(text).toContain("Customer Information");
    expect(text).toContain("Order Lifecycle Status");
    expect(text).toContain("Order Items");
    expect(text).toContain("Grand Total");
  });

  it("renders live order details when found in database", async () => {
    const mockDbOrder = {
      id: "ord_live_999",
      number: 1088,
      buyer_name: "Almaz Ayana",
      buyer_phone: "0922334455",
      sms_consent: true,
      consent_wording: "Send me SMS updates",
      state: "ready",
      total_santim: 120000,
      created_at: new Date(),
      order_items: [
        {
          id: "item_99",
          name_at_order: "Special Coffee Beans",
          quantity: 2,
          unit_price_santim: 60000,
        },
      ],
      order_events: [],
      messages: [
        {
          id: "msg_live_1",
          event: "buyer_order_ready",
          phone: "0922334455",
          status: "sent",
          created_at: new Date(),
        },
      ],
      action_tokens: [],
      pickup_code: null,
    };

    prismaMock.order.findUnique.mockResolvedValue(mockDbOrder);

    const element = await OrderDetailPage({
      params: Promise.resolve({ id: "ord_live_999" }),
    });

    expect(element).toBeDefined();
    const text = extractText(element);
    expect(text).toContain("1088");
    expect(text).toContain("Almaz Ayana");
    expect(text).toContain("Special Coffee Beans");
    expect(text).toContain("1200");
    expect(text).toContain("ETB");
  });

  it("renders correctly for rejected state", async () => {
    const mockRejectedOrder = {
      id: "ord_rejected_1",
      number: 1099,
      buyer_name: "Kenenisa Bekele",
      buyer_phone: "0933445566",
      sms_consent: false,
      state: "rejected",
      total_santim: 50000,
      order_items: [],
      order_events: [],
      messages: [],
      action_tokens: [],
      pickup_code: null,
    };

    prismaMock.order.findUnique.mockResolvedValue(mockRejectedOrder);

    const element = await OrderDetailPage({
      params: Promise.resolve({ id: "ord_rejected_1" }),
    });

    expect(element).toBeDefined();
    const text = extractText(element);
    expect(text).toContain("Order Rejected");
  });
});
