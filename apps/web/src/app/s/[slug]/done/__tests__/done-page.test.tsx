import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      order: {
        findUnique: vi.fn(),
      },
      seller: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import { renderToString } from "react-dom/server";
import DonePage from "../page";

// Helper to recursively extract all text content from JSX tree
function extractText(node: any): string {
  if (!node) return "";
  try {
    const html = renderToString(node);
    return html.replace(/<[^>]+>/g, " ");
  } catch {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join(" ");
    if (node.props?.children) return extractText(node.props.children);
    return "";
  }
}

describe("DonePage (FE-004 - /s/[slug]/done)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Order Number Rendering", () => {
    it("displays actual assigned 4-digit order number from database", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        number: 1001,
        sms_consent: true,
        seller: {
          sms_name: "Habesha Cafe",
          business_name: "Habesha Cafe & Bakery",
        },
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({ orderId: "ord-uuid-1001" }),
      });

      expect(element).toBeDefined();
      const text = extractText(element);
      expect(text).toContain("Order #1001");
      expect(text).toContain("at Habesha Cafe");
    });

    it("displays assigned order number passed via searchParams when order is not found in database", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      prismaMock.seller.findUnique.mockResolvedValue({
        sms_name: "Habesha Cafe",
        business_name: "Habesha Cafe",
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({
          orderNumber: "1042",
          consent: "true",
        }),
      });

      const text = extractText(element);
      expect(text).toContain("Order #1042");
    });
  });

  describe("Buyer SMS Consent State (Acceptance Criteria)", () => {
    it("explains text updates will follow when buyer consented (database record)", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        number: 1001,
        sms_consent: true,
        seller: {
          sms_name: "Habesha Cafe",
          business_name: "Habesha Cafe",
        },
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({ orderId: "ord-1" }),
      });

      const text = extractText(element);
      // Explains text updates will follow
      expect(text).toContain("You will receive text updates when your order is accepted and ready for pickup");
      expect(text).toContain("Pickup Code via SMS");
      // Does NOT show opt-out guidance
      expect(text).not.toContain("Check with Seller");
      expect(text).not.toContain("opted out of SMS updates");
    });

    it("explains text updates will follow when buyer consented via searchParams", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      prismaMock.seller.findUnique.mockResolvedValue({
        sms_name: "Habesha Cafe",
        business_name: "Habesha Cafe",
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({
          orderNumber: "1005",
          consent: "true",
        }),
      });

      const text = extractText(element);
      expect(text).toContain("Order #1005");
      expect(text).toContain("The seller has been notified via SMS");
      expect(text).toContain("Pickup Code via SMS");
      expect(text).not.toContain("Check with Seller");
    });

    it("reminds buyer to check with seller when buyer opted out (database record)", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        number: 1002,
        sms_consent: false,
        seller: {
          sms_name: "Habesha Cafe",
          business_name: "Habesha Cafe",
        },
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({ orderId: "ord-2" }),
      });

      const text = extractText(element);
      // Reminds buyer to check with seller
      expect(text).toContain("Check with Seller");
      expect(text).toContain("opted out of SMS updates");
      expect(text).toContain("please check with the seller directly");
      // Does NOT show pickup code via SMS banner
      expect(text).not.toContain("Pickup Code via SMS");
    });

    it("reminds buyer to check with seller when buyer opted out via searchParams (consent=false)", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      prismaMock.seller.findUnique.mockResolvedValue({
        sms_name: "Habesha Cafe",
        business_name: "Habesha Cafe",
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({
          orderNumber: "1003",
          consent: "false",
        }),
      });

      const text = extractText(element);
      expect(text).toContain("Order #1003");
      expect(text).toContain("Check with Seller");
      expect(text).toContain("opted out of SMS updates");
      expect(text).not.toContain("Pickup Code via SMS");
    });
  });

  describe("Privacy & Navigation Invariants", () => {
    it("does not leak buyer phone number or personal details", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        number: 1001,
        sms_consent: true,
        seller: {
          sms_name: "Habesha Cafe",
          business_name: "Habesha Cafe",
        },
      });

      const element = await DonePage({
        params: Promise.resolve({ slug: "habesha-cafe" }),
        searchParams: Promise.resolve({ orderId: "ord-1" }),
      });

      const text = extractText(element);
      expect(text).not.toContain("0911");
      expect(text).not.toContain("+251");
    });

    it("renders navigation link back to storefront", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      const element = await DonePage({
        params: Promise.resolve({ slug: "my-shop" }),
      });

      const text = extractText(element);
      expect(text).toContain("Back to Storefront");
    });
  });
});
