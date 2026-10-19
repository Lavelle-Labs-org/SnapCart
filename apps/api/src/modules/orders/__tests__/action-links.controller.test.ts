import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ActionLinksController } from "../action-links.controller";

describe("ActionLinksController (BE-011)", () => {
  let controller: ActionLinksController;
  let ordersServiceMock: any;
  let cryptoServiceMock: any;
  let prismaMock: any;

  const validToken = "K9x2m1ZbQrT4uV8wY0aBcD";
  const validTokenHash = "mock_hash_for_valid_token";

  const mockSeller = {
    id: "seller-123",
    business_name: "Habesha Cafe & Bakery",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    slug: "habesha-cafe",
  };

  const mockOrder = {
    id: "order-uuid-1",
    seller_id: "seller-123",
    number: 1043,
    buyer_name: "Abebe Bikila",
    buyer_phone: "0911223344",
    sms_consent: true,
    consent_wording: "I agree to receive SMS",
    consent_at: new Date(),
    state: "new",
    total_santim: 85000,
    created_at: new Date(),
    seller: mockSeller,
    order_items: [
      {
        id: "item-1",
        order_id: "order-uuid-1",
        product_id: "prod-1",
        name_at_order: "Special Combo",
        unit_price_santim: 35000,
        quantity: 2,
      },
    ],
  };

  const activeTokenRecord = {
    id: "token-record-1",
    order_id: "order-uuid-1",
    purpose: "seller_action",
    token_hash: validTokenHash,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h in future
    revoked_at: null,
    order: mockOrder,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    cryptoServiceMock = {
      hashActionToken: vi.fn().mockReturnValue(validTokenHash),
    };

    prismaMock = {
      actionToken: {
        findUnique: vi.fn(),
      },
    };

    ordersServiceMock = {
      resolveActionToken: vi.fn(),
      transitionOrderState: vi.fn(),
    };

    controller = new ActionLinksController(
      ordersServiceMock,
      prismaMock,
      cryptoServiceMock
    );
  });

  describe("Token Resolution & Verification Guard", () => {
    it("rejects with 404 when action token is not found in database", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue(null);

      await expect(controller.getActionOrder("unknown_token")).rejects.toThrow(
        NotFoundException
      );
    });

    it("rejects with 404 when action token has expired (>48 hours)", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        ...activeTokenRecord,
        expires_at: new Date(Date.now() - 1000), // Expired 1 second ago
      });

      await expect(controller.getActionOrder(validToken)).rejects.toThrow(
        NotFoundException
      );
    });

    it("rejects with 404 when action token has been revoked", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        ...activeTokenRecord,
        revoked_at: new Date(Date.now() - 5000),
      });

      await expect(controller.getActionOrder(validToken)).rejects.toThrow(
        NotFoundException
      );
    });

    it("rejects with 404 when token purpose is not seller_action", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        ...activeTokenRecord,
        purpose: "buyer_stop",
      });

      await expect(controller.getActionOrder(validToken)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("GET /api/a/:token (Read-only Order Preview)", () => {
    it("returns sanitized order details and action token for active link", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue(activeTokenRecord);

      const result = await controller.getActionOrder(validToken);

      expect(result).toBeDefined();
      expect(result.orderNumber).toBe(1043);
      expect(result.state).toBe("new");
      expect(result.totalSantim).toBe(85000);
      expect(result.items?.length).toBe(1);
      expect(cryptoServiceMock.hashActionToken).toHaveBeenCalledWith(validToken);
    });
  });

  describe("POST /api/a/:token/accept", () => {
    it("invokes transitionOrderState with 'accepted' and actor 'seller_link'", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue(activeTokenRecord);

      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        isIdempotent: false,
        orderId: "order-uuid-1",
        orderNumber: 1043,
        previousState: "new",
        currentState: "accepted",
        smsResult: { status: "sent", messageId: "msg_buyer_accepted" },
      });

      const response = await controller.acceptOrder(validToken);

      expect(ordersServiceMock.transitionOrderState).toHaveBeenCalledWith(
        "order-uuid-1",
        "accepted",
        "seller_link"
      );

      expect(response.currentState).toBe("accepted");
      expect(response.smsStatus).toBe("sent");
      expect(response.orderNumber).toBe(1043);
    });
  });

  describe("POST /api/a/:token/reject", () => {
    it("invokes transitionOrderState with 'rejected' and actor 'seller_link'", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue(activeTokenRecord);

      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        isIdempotent: false,
        orderId: "order-uuid-1",
        orderNumber: 1043,
        previousState: "new",
        currentState: "rejected",
        smsResult: { status: "sent", messageId: "msg_buyer_rejected" },
      });

      const response = await controller.rejectOrder(validToken);

      expect(ordersServiceMock.transitionOrderState).toHaveBeenCalledWith(
        "order-uuid-1",
        "rejected",
        "seller_link"
      );

      expect(response.currentState).toBe("rejected");
      expect(response.smsStatus).toBe("sent");
    });
  });

  describe("POST /api/a/:token/ready", () => {
    it("invokes transitionOrderState with 'ready' and actor 'seller_link', returning pickup code and SMS status", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        ...activeTokenRecord,
        order: { ...mockOrder, state: "accepted" },
      });

      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        isIdempotent: false,
        orderId: "order-uuid-1",
        orderNumber: 1043,
        previousState: "accepted",
        currentState: "ready",
        pickupCode: "4821",
        smsResult: { status: "sent", messageId: "msg_buyer_ready" },
      });

      const response = await controller.readyOrder(validToken);

      expect(ordersServiceMock.transitionOrderState).toHaveBeenCalledWith(
        "order-uuid-1",
        "ready",
        "seller_link"
      );

      expect(response.currentState).toBe("ready");
      expect(response.pickupCode).toBe("4821");
      expect(response.smsStatus).toBe("sent");
    });
  });

  describe("Idempotency Handling", () => {
    it("returns idempotent response when already transitioned to target state", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue(activeTokenRecord);

      ordersServiceMock.transitionOrderState.mockResolvedValue({
        success: true,
        isIdempotent: true,
        orderId: "order-uuid-1",
        orderNumber: 1043,
        previousState: "accepted",
        currentState: "accepted",
        message: "Order is already in state 'accepted'. No change needed.",
      });

      const response = await controller.acceptOrder(validToken);

      expect(response.isIdempotent).toBe(true);
      expect(response.currentState).toBe("accepted");
    });
  });
});
