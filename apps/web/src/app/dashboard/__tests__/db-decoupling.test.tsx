import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      order: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      message: {
        findMany: vi.fn(),
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

vi.mock("../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import { SignJWT } from "jose";

process.env.SESSION_SECRET = "test_session_secret_32_characters_long_minimum";

const cookieStoreMock = {
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue(cookieStoreMock),
}));

async function createTestToken(sellerId: string): Promise<string> {
  const secretKey = new TextEncoder().encode(process.env.SESSION_SECRET!);
  return await new SignJWT({ sellerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

const { redirectMock, notFoundMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  notFoundMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  redirect: redirectMock,
  notFound: notFoundMock,
}));

import OrdersDashboardPage from "../page";
import ProductsPage from "../products/page";
import MessagesLogPage from "../messages/page";
import OrderDetailPage from "../orders/[id]/page";
import SettingsPage from "../settings/page";
import DashboardLayout from "../layout";

import { renderToString } from "react-dom/server";

// Helper to recursively extract text from JSX tree
function extractText(node: any): string {
  if (!node) return "";
  try {
    const html = renderToString(node);
    return html.replace(/<[^>]+>/g, " ");
  } catch {
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map(extractText).join(" ");
    const parts: string[] = [];
    if (node.props?.displayName) parts.push(String(node.props.displayName));
    if (node.props?.displaySubtitle) parts.push(String(node.props.displaySubtitle));
    if (node.props?.seller?.business_name) parts.push(String(node.props.seller.business_name));
    if (node.props?.seller?.slug) parts.push(`@${node.props.seller.slug}`);
    if (node.props?.children) parts.push(extractText(node.props.children));
    return parts.join(" ");
  }
}

describe("Next.js Server Components Database Decoupling (PR-010, Issue #129)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    cookieStoreMock.get.mockReturnValue(undefined);

    // Simulate database being disconnected or DATABASE_URL omitted: Prisma throws connection error
    prismaMock.order.findMany.mockRejectedValue(
      new Error("Environment variable not found: DATABASE_URL")
    );
    prismaMock.order.findUnique.mockRejectedValue(
      new Error("Environment variable not found: DATABASE_URL")
    );
    prismaMock.product.findMany.mockRejectedValue(
      new Error("Environment variable not found: DATABASE_URL")
    );
    prismaMock.message.findMany.mockRejectedValue(
      new Error("Environment variable not found: DATABASE_URL")
    );
    prismaMock.seller.findUnique.mockRejectedValue(
      new Error("Environment variable not found: DATABASE_URL")
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("OrdersDashboardPage (/dashboard)", () => {
    it("loads orders from NestJS API when DATABASE_URL is omitted / Prisma fails", async () => {
      const token = await createTestToken("seller_decoupled_1");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const mockApiOrders = [
        {
          id: "ord_api_1",
          sellerId: "seller_decoupled_1",
          number: 2001,
          buyerName: "Almaz Ayana",
          buyerPhone: "0912345678",
          state: "new",
          totalSantim: 55000,
          createdAt: new Date().toISOString(),
          items: [
            {
              id: "item_1",
              nameAtOrder: "Ethiopian Yirgacheffe Coffee",
              unitPriceSantim: 55000,
              quantity: 1,
            },
          ],
        },
      ];

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/orders")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockApiOrders,
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch: ${url}`));
      });

      const element = await OrdersDashboardPage({});
      expect(element).toBeDefined();

      // Verify Prisma was attempted and failed
      expect(prismaMock.order.findMany).toHaveBeenCalled();

      // Verify fetch was dispatched to NestJS API with session credentials
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: `seller_session=${token}`,
            Authorization: `Bearer ${token}`,
          }),
        })
      );

      const text = extractText(element);
      expect(text).toContain("#2001");
      expect(text).toContain("Almaz Ayana");
      expect(text).toContain("550.00 ETB");
      expect(text).toContain("1 order live");
    });
  });

  describe("ProductsPage (/dashboard/products)", () => {
    it("loads products from NestJS API when DATABASE_URL is omitted / Prisma fails", async () => {
      const token = await createTestToken("seller_decoupled_2");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const mockApiProducts = [
        {
          id: "prod_api_1",
          sellerId: "seller_decoupled_2",
          name: "Organic Honey 500g",
          priceSantim: 25000,
          available: true,
        },
      ];

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/products")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockApiProducts,
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch: ${url}`));
      });

      const element = await ProductsPage({});
      expect(element).toBeDefined();

      // Verify fetch was dispatched to NestJS API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/products"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: `seller_session=${token}`,
            Authorization: `Bearer ${token}`,
          }),
        })
      );

      expect(element.props.initialProducts).toHaveLength(1);
      expect(element.props.initialProducts[0].name).toBe("Organic Honey 500g");
      expect(element.props.initialProducts[0].priceSantim).toBe(25000);
    });
  });

  describe("MessagesLogPage (/dashboard/messages)", () => {
    it("loads audit messages from NestJS API when DATABASE_URL is omitted / Prisma fails", async () => {
      const token = await createTestToken("seller_decoupled_3");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const mockApiMessages = [
        {
          id: "msg_api_1",
          sellerId: "seller_decoupled_3",
          recipientPhone: "0911223344",
          event: "order_ready",
          text: "Your order #1001 is ready for pickup!",
          status: "sent",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/messages")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockApiMessages,
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch: ${url}`));
      });

      const element = await MessagesLogPage({});
      expect(element).toBeDefined();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/messages"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: `seller_session=${token}`,
            Authorization: `Bearer ${token}`,
          }),
        })
      );

      expect(element.props.initialMessages).toHaveLength(1);
      expect(element.props.initialMessages[0].id).toBe("msg_api_1");
      expect(element.props.initialMessages[0].status).toBe("sent");
    });
  });

  describe("OrderDetailPage (/dashboard/orders/[id])", () => {
    it("loads order details from NestJS API when DATABASE_URL is omitted / Prisma fails", async () => {
      const token = await createTestToken("seller_decoupled_4");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const mockOrderDetail = {
        id: "ord_api_detail_99",
        sellerId: "seller_decoupled_4",
        number: 3005,
        buyerName: "Kenenisa Bekele",
        buyerPhone: "0944556677",
        smsConsent: true,
        consentWording: "I agree to SMS",
        consentAt: new Date().toISOString(),
        state: "accepted",
        totalSantim: 120000,
        createdAt: new Date().toISOString(),
        items: [
          {
            id: "item_99",
            nameAtOrder: "Injera with Shiro Special",
            unitPriceSantim: 120000,
            quantity: 1,
          },
        ],
        events: [
          {
            id: "evt_1",
            fromState: "new",
            toState: "accepted",
            actor: "seller_dash",
            createdAt: new Date().toISOString(),
          },
        ],
        messages: [
          {
            id: "msg_detail_1",
            recipientPhone: "0944556677",
            event: "order_accepted",
            status: "sent",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/orders/ord_api_detail_99")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockOrderDetail,
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch: ${url}`));
      });

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_api_detail_99" }),
      });
      expect(element).toBeDefined();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/ord_api_detail_99"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: `seller_session=${token}`,
            Authorization: `Bearer ${token}`,
          }),
        })
      );

      const text = extractText(element);
      expect(text).toContain("Order #3005");
      expect(text).toContain("Kenenisa Bekele");
      expect(text).toContain("1200.00 ETB");
      expect(text).toContain("Injera with Shiro Special");
      expect(text).toContain("Accepted");
    });
  });

  describe("SettingsPage & DashboardLayout", () => {
    it("loads seller profile from NestJS API when DATABASE_URL is omitted", async () => {
      const token = await createTestToken("seller_decoupled_5");
      cookieStoreMock.get.mockReturnValue({ value: token });

      const mockSellerProfile = {
        seller: {
          id: "seller_decoupled_5",
          business_name: "Abyssinia Roastery",
          sms_name: "Abyssinia",
          slug: "abyssinia-roastery",
          phone: "0911002233",
        },
      };

      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockSellerProfile,
            }),
          });
        }
        return Promise.reject(new Error(`Unhandled fetch: ${url}`));
      });

      const settingsElement = await SettingsPage({});
      expect(settingsElement).toBeDefined();
      expect(settingsElement.props.initialSeller.businessName).toBe("Abyssinia Roastery");

      const layoutElement = await DashboardLayout({ children: <div>Dashboard Content</div> });
      expect(layoutElement).toBeDefined();
      const layoutText = extractText(layoutElement);
      expect(layoutText).toContain("Abyssinia Roastery");
      expect(layoutText).toContain("@abyssinia-roastery");
    });
  });
});
