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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

import OrderDetailPage from "../page";
import OrderActions from "../order-actions";

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

describe("OrderDetailPage (FE-010, Issue #33 - /dashboard/orders/[id])", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Order Details & Items Breakdown (Acceptance Criterion 1)", () => {
    it("renders itemized list, unit prices in Birr, grand total, and buyer contact info", async () => {
      const mockOrder = {
        id: "ord_full_1",
        number: 1042,
        buyer_name: "Abebe Bikila",
        buyer_phone: "0911223344",
        sms_consent: true,
        consent_wording: "Send me SMS updates",
        state: "accepted",
        total_santim: 85000,
        created_at: new Date(),
        order_items: [
          {
            id: "item_1",
            name_at_order: "Special Habesha Doro Wat",
            quantity: 1,
            unit_price_santim: 65000,
          },
          {
            id: "item_2",
            name_at_order: "Fresh Injera (Pack of 3)",
            quantity: 2,
            unit_price_santim: 10000,
          },
        ],
        order_events: [],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_full_1" }),
      });

      expect(element).toBeDefined();
      const text = extractText(element);

      // Order number and title
      expect(text).toContain("Order #1042");
      expect(text).toContain("ID: ord_full_1");

      // Customer info & masked phone
      expect(text).toContain("Abebe Bikila");
      expect(text).toContain("09•• ••• 344");
      expect(text).toContain("SMS Consent Granted");

      // Item breakdown
      expect(text).toContain("Special Habesha Doro Wat");
      expect(text).toContain("1 × 650.00 ETB");
      expect(text).toContain("650.00 ETB");
      expect(text).toContain("Fresh Injera (Pack of 3)");
      expect(text).toContain("2 × 100.00 ETB");
      expect(text).toContain("200.00 ETB");

      // Grand total in Birr
      expect(text).toContain("Grand Total");
      expect(text).toContain("850.00 ETB");
    });
  });

  describe("State Transition History Timeline (Acceptance Criterion 2)", () => {
    it("renders chronological state transition audit trail from order_events", async () => {
      const mockOrder = {
        id: "ord_events_1",
        number: 1043,
        buyer_name: "Sara Hailu",
        buyer_phone: "0799887766",
        sms_consent: true,
        state: "ready",
        total_santim: 40000,
        order_items: [],
        order_events: [
          {
            id: "evt_1",
            from_state: null,
            to_state: "new",
            actor: "buyer",
            created_at: new Date(Date.now() - 3600 * 1000),
          },
          {
            id: "evt_2",
            from_state: "new",
            to_state: "accepted",
            actor: "seller_dash",
            created_at: new Date(Date.now() - 1800 * 1000),
          },
          {
            id: "evt_3",
            from_state: "accepted",
            to_state: "ready",
            actor: "seller_link",
            created_at: new Date(Date.now() - 600 * 1000),
          },
        ],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_events_1" }),
      });

      const text = extractText(element);
      expect(text).toContain("State Transition Audit History");
      expect(text).toContain("Created as new");
      expect(text).toContain("new → accepted");
      expect(text).toContain("accepted → ready");
      expect(text).toContain("seller_dash");
      expect(text).toContain("seller_link");
      expect(text).toContain("buyer");
    });

    it("displays friendly empty notice when no order_events exist", async () => {
      const mockOrder = {
        id: "ord_no_events",
        number: 1044,
        buyer_name: "Dawit Kebede",
        buyer_phone: "0922334455",
        sms_consent: false,
        state: "new",
        total_santim: 30000,
        order_items: [],
        order_events: [],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_no_events" }),
      });

      const text = extractText(element);
      expect(text).toContain("No transition events recorded yet");
    });
  });

  describe("SMS Audit Log Table (Acceptance Criterion 3)", () => {
    it("renders SMS audit log messages with event types, masked phones, and status badges", async () => {
      const mockOrder = {
        id: "ord_sms_1",
        number: 1045,
        buyer_name: "Tigist Alemu",
        buyer_phone: "0933445566",
        sms_consent: true,
        state: "ready",
        total_santim: 60000,
        order_items: [],
        order_events: [],
        messages: [
          {
            id: "msg_1",
            event: "seller_new_order",
            recipient_phone: "0988776655",
            status: "sent",
            created_at: new Date(),
          },
          {
            id: "msg_2",
            event: "buyer_order_ready",
            recipient_phone: "0933445566",
            status: "sent",
            created_at: new Date(),
          },
        ],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_sms_1" }),
      });

      const text = extractText(element);
      expect(text).toContain("SMS Notifications Audit Log");
      expect(text).toContain("seller_new_order");
      expect(text).toContain("buyer_order_ready");
      expect(text).toContain("09•• ••• 566");
      // Never displays delivered per Invariant #8
      expect(text).not.toContain("delivered");
    });
  });

  describe("Action Buttons Matching Order State (Acceptance Criterion 4)", () => {
    it("passes order state and ID to OrderActions component when in 'new' state", async () => {
      const mockNewOrder = {
        id: "ord_new_state",
        number: 1046,
        buyer_name: "Almaz Ayana",
        buyer_phone: "0911223344",
        state: "new",
        total_santim: 50000,
        order_items: [],
        order_events: [],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockNewOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_new_state" }),
      });

      const actions = findElements(element, (n) => n.type === OrderActions);
      expect(actions.length).toBe(1);
      expect(actions[0].props.orderId).toBe("ord_new_state");
      expect(actions[0].props.initialState).toBe("new");
    });

    it("passes order state and ID to OrderActions component when in 'accepted' state", async () => {
      const mockAcceptedOrder = {
        id: "ord_accepted_state",
        number: 1047,
        buyer_name: "Almaz Ayana",
        buyer_phone: "0911223344",
        state: "accepted",
        total_santim: 50000,
        order_items: [],
        order_events: [],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockAcceptedOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_accepted_state" }),
      });

      const actions = findElements(element, (n) => n.type === OrderActions);
      expect(actions.length).toBe(1);
      expect(actions[0].props.orderId).toBe("ord_accepted_state");
      expect(actions[0].props.initialState).toBe("accepted");
    });

    it("passes order state and ID to OrderActions component when in 'ready' state", async () => {
      const mockReadyOrder = {
        id: "ord_ready_state",
        number: 1048,
        buyer_name: "Almaz Ayana",
        buyer_phone: "0911223344",
        state: "ready",
        total_santim: 50000,
        order_items: [],
        order_events: [],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockReadyOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_ready_state" }),
      });

      const actions = findElements(element, (n) => n.type === OrderActions);
      expect(actions.length).toBe(1);
      expect(actions[0].props.orderId).toBe("ord_ready_state");
      expect(actions[0].props.initialState).toBe("ready");
    });

    it("renders terminal state notice in banner when order is rejected", async () => {
      const mockRejectedOrder = {
        id: "ord_rej_state",
        number: 1049,
        buyer_name: "Almaz Ayana",
        buyer_phone: "0911223344",
        state: "rejected",
        total_santim: 50000,
        order_items: [],
        order_events: [],
        messages: [],
        pickup_code: null,
      };

      prismaMock.order.findUnique.mockResolvedValue(mockRejectedOrder);

      const element = await OrderDetailPage({
        params: Promise.resolve({ id: "ord_rej_state" }),
      });

      const text = extractText(element);
      expect(text).toContain("Order Rejected");
      expect(text).toContain("This order was declined and will not proceed to fulfillment");
    });
  });
});
