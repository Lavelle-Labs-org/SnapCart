import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      order: {
        findMany: vi.fn(),
      },
      seller: {
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import OrdersDashboardPage from "../page";
import {
  extractSellerIdFromToken,
  formatOrderTime,
  getStatusBadge,
} from "../dashboard-helpers";

// Helper to recursively extract all text content from JSX tree
function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (node.props?.children) return extractText(node.props.children);
  return "";
}

// Helper to find all elements matching a predicate in JSX tree
function findElements(node: any, predicate: (n: any) => boolean): any[] {
  const results: any[] = [];
  if (!node) return results;
  if (predicate(node)) results.push(node);
  if (Array.isArray(node)) {
    for (const item of node) results.push(...findElements(item, predicate));
  } else if (node.props?.children) {
    results.push(...findElements(node.props.children, predicate));
  }
  return results;
}

describe("OrdersDashboardPage (FE-009, Issue #32)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Utility & Token Extraction Helpers", () => {
    it("extracts sellerId from valid JWT payload", () => {
      const payload = { sellerId: "seller_test_123", iat: 1700000000 };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
      const token = `eyJhbGciOiJIUzI1NiJ9.${base64Payload}.dummySignature`;

      expect(extractSellerIdFromToken(token)).toBe("seller_test_123");
    });

    it("returns null for malformed or missing sellerId tokens", () => {
      expect(extractSellerIdFromToken("")).toBeNull();
      expect(extractSellerIdFromToken("invalid-token")).toBeNull();

      const emptyPayload = Buffer.from(JSON.stringify({})).toString("base64");
      expect(extractSellerIdFromToken(`header.${emptyPayload}.sig`)).toBeNull();
    });

    it("formats relative order timestamps accurately", () => {
      const now = Date.now();
      expect(formatOrderTime(new Date(now - 10 * 1000))).toBe("Just now");
      expect(formatOrderTime(new Date(now - 65 * 1000))).toBe("1 min ago");
      expect(formatOrderTime(new Date(now - 15 * 60 * 1000))).toBe("15 mins ago");
      expect(formatOrderTime(new Date(now - 3600 * 1000))).toBe("1 hour ago");
      expect(formatOrderTime(new Date(now - 5 * 3600 * 1000))).toBe("5 hours ago");
      expect(formatOrderTime(new Date(now - 25 * 3600 * 1000))).toBe("Yesterday");
    });

    it("renders distinct badges for all order states", () => {
      const states = ["new", "accepted", "ready", "completed", "rejected", "custom_state"];
      for (const state of states) {
        const badge = getStatusBadge(state);
        expect(badge).toBeDefined();
        const text = extractText(badge);
        expect(text.toLowerCase()).toContain(state === "custom_state" ? "custom_state" : state);
      }
    });
  });

  describe("Live Orders Display (Acceptance Criteria 1)", () => {
    it("queries database sorted newest first and displays live orders queue", async () => {
      const mockOrders = [
        {
          id: "ord_101",
          number: 1045,
          buyer_name: "Abebe Bikila",
          buyer_phone: "0911223344",
          total_santim: 85000,
          state: "new",
          created_at: new Date(Date.now() - 5 * 60 * 1000),
        },
        {
          id: "ord_102",
          number: 1044,
          buyer_name: "Sara Hailu",
          buyer_phone: "0799887766",
          total_santim: 40000,
          state: "accepted",
          created_at: new Date(Date.now() - 30 * 60 * 1000),
        },
        {
          id: "ord_103",
          number: 1043,
          buyer_name: "Dawit Kebede",
          buyer_phone: "0922334455",
          total_santim: 125000,
          state: "ready",
          created_at: new Date(Date.now() - 75 * 60 * 1000),
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders);

      const element = await OrdersDashboardPage({});
      expect(element).toBeDefined();

      // Verified query was called with newest first ordering
      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: { order_items: true },
        orderBy: { created_at: "desc" },
      });

      const text = extractText(element);

      // Verify order numbers
      expect(text).toContain("#1045");
      expect(text).toContain("#1044");
      expect(text).toContain("#1043");

      // Verify customer names
      expect(text).toContain("Abebe Bikila");
      expect(text).toContain("Sara Hailu");
      expect(text).toContain("Dawit Kebede");

      // Verify phone masking per privacy invariant
      expect(text).toContain("09•• ••• 344");
      expect(text).toContain("07•• ••• 766");
      expect(text).not.toContain("0911223344");

      // Verify formatted totals
      expect(text).toContain("850.00 ETB");
      expect(text).toContain("400.00 ETB");
      expect(text).toContain("1250.00 ETB");

      // Verify state badges
      expect(text).toContain("New");
      expect(text).toContain("Accepted");
      expect(text).toContain("Ready");

      // Verify order count indicator
      expect(text).toContain("3 orders live");
    });

    it("scopes query by authenticated sellerId when provided via searchParams", async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      await OrdersDashboardPage({
        searchParams: Promise.resolve({ sellerId: "seller_42" }),
      });

      expect(prismaMock.order.findMany).toHaveBeenCalledWith({
        where: { seller_id: "seller_42" },
        include: { order_items: true },
        orderBy: { created_at: "desc" },
      });
    });
  });

  describe("Empty State (Acceptance Criteria 2)", () => {
    it("displays empty state with helpful prompt when seller has 0 orders", async () => {
      prismaMock.order.findMany.mockResolvedValue([]);

      const element = await OrdersDashboardPage({});
      expect(element).toBeDefined();

      const text = extractText(element);

      // Helpful prompt
      expect(text).toContain("No orders yet");
      expect(text).toContain("When customers place orders from your storefront, they will appear here in real time");
      expect(text).toContain("Share your shop link to start receiving orders!");

      // Action links
      expect(text).toContain("View Storefront Link");
      expect(text).toContain("Manage Products");

      // Links exist in JSX
      const links = findElements(element, (n) => n.props?.href !== undefined);
      const hrefs = links.map((l) => l.props.href);
      expect(hrefs).toContain("/dashboard/settings");
      expect(hrefs).toContain("/dashboard/products");
    });
  });

  describe("Order Row Navigation (Acceptance Criteria 3)", () => {
    it("renders clickable links to /dashboard/orders/[id] for each order row", async () => {
      const mockOrders = [
        {
          id: "ord_target_999",
          number: 1099,
          buyer_name: "Tigist Alemu",
          buyer_phone: "0933445566",
          total_santim: 60000,
          state: "completed",
          created_at: new Date(),
        },
      ];

      prismaMock.order.findMany.mockResolvedValue(mockOrders);

      const element = await OrdersDashboardPage({});
      const links = findElements(element, (n) => n.props?.href === "/dashboard/orders/ord_target_999");

      // Links to order detail page should exist in the row
      expect(links.length).toBeGreaterThanOrEqual(1);

      const text = extractText(element);
      expect(text).toContain("View Details");
    });
  });
});
