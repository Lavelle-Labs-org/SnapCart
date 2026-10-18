import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { OrdersService } from "../orders.service";
import { transitionOrderState } from "../../../services/order";

describe("OrdersService - Centralized Order State Orchestrator (BE-010)", () => {
  let service: OrdersService;
  let prismaMock: any;
  let smsOrchestratorMock: any;
  let cryptoServiceMock: any;

  const mockSeller = {
    id: "seller-123",
    business_name: "Habesha Cafe & Bakery",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    slug: "habesha-cafe",
  };

  const mockOrderNew = {
    id: "order-uuid-1",
    seller_id: "seller-123",
    number: 1001,
    buyer_name: "Abebe Kebede",
    buyer_phone: "0922334455",
    sms_consent: true,
    state: "new",
    total_santim: 45000,
    created_at: new Date(),
    seller: mockSeller,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock = {
      order: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      orderEvent: {
        create: vi.fn(),
      },
      pickupCode: {
        upsert: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      actionToken: {
        updateMany: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prismaMock)),
    };

    smsOrchestratorMock = {
      sendOrderSMS: vi.fn().mockResolvedValue({
        status: "sent",
        messageId: "msg-123",
        text: "Test SMS",
      }),
    };

    cryptoServiceMock = {
      generatePickupCode: vi.fn().mockReturnValue("4821"),
      hashPickupCode: vi.fn().mockReturnValue("mock_hmac_hash_4821"),
      verifyPickupCodeHash: vi.fn(),
    };

    service = new OrdersService(
      prismaMock,
      smsOrchestratorMock,
      cryptoServiceMock
    );
  });

  describe("Validation & Guard Rails", () => {
    it("throws NotFoundException when order does not exist", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.transitionOrderState("non-existent-id", "accepted", "seller_link")
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.order.update).not.toHaveBeenCalled();
      expect(smsOrchestratorMock.sendOrderSMS).not.toHaveBeenCalled();
    });

    it("throws ConflictException on invalid state transitions (e.g. new -> ready)", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "new" });

      await expect(
        service.transitionOrderState("order-uuid-1", "ready", "seller_link")
      ).rejects.toThrow(ConflictException);

      expect(prismaMock.order.update).not.toHaveBeenCalled();
      expect(smsOrchestratorMock.sendOrderSMS).not.toHaveBeenCalled();
    });

    it("throws ConflictException when attempting transition from terminal state 'rejected'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "rejected" });

      await expect(
        service.transitionOrderState("order-uuid-1", "accepted", "seller_link")
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException when attempting transition from terminal state 'completed'", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "completed" });

      await expect(
        service.transitionOrderState("order-uuid-1", "ready", "seller_link")
      ).rejects.toThrow(ConflictException);
    });

    it("returns idempotent success without duplicate mutations when order is already in target state", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "accepted" });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "accepted",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.isIdempotent).toBe(true);
      expect(result.currentState).toBe("accepted");
      expect(prismaMock.order.update).not.toHaveBeenCalled();
      expect(prismaMock.orderEvent.create).not.toHaveBeenCalled();
      expect(smsOrchestratorMock.sendOrderSMS).not.toHaveBeenCalled();
    });
  });

  describe("Valid State Transitions & Side Effects", () => {
    it("transitions new -> accepted: commits state, creates order_event, and dispatches buyer SMS", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "new" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "accepted" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-1" });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "accepted",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.isIdempotent).toBe(false);
      expect(result.previousState).toBe("new");
      expect(result.currentState).toBe("accepted");

      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: "order-uuid-1" },
        data: { state: "accepted" },
      });

      expect(prismaMock.orderEvent.create).toHaveBeenCalledWith({
        data: {
          order_id: "order-uuid-1",
          from_state: "new",
          to_state: "accepted",
          actor: "seller_link",
        },
      });

      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-uuid-1",
          recipientPhone: "0922334455",
          event: "buyer_order_accepted",
          shopName: "Habesha Cafe",
          orderNumber: 1001,
          smsConsent: true,
          throwOnError: false,
        })
      );
    });

    it("transitions new -> rejected: commits state, creates order_event, revokes action tokens, and sends rejection SMS", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "new" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "rejected" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-2" });
      prismaMock.actionToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "rejected",
        "seller_dash"
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("rejected");

      expect(prismaMock.actionToken.updateMany).toHaveBeenCalledWith({
        where: { order_id: "order-uuid-1", revoked_at: null },
        data: expect.objectContaining({ revoked_at: expect.any(Date) }),
      });

      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-uuid-1",
          recipientPhone: "0922334455",
          event: "buyer_order_rejected",
          shopName: "Habesha Cafe",
          orderNumber: 1001,
        })
      );
    });

    it("transitions accepted -> ready: generates 4-digit pickup code, stores HMAC in pickup_codes, and sends SMS with code", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "accepted" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "ready" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-3" });
      prismaMock.pickupCode.upsert.mockResolvedValue({ id: "pickup-1" });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "ready",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("ready");
      expect(result.pickupCode).toBe("4821");

      expect(cryptoServiceMock.generatePickupCode).toHaveBeenCalled();
      expect(cryptoServiceMock.hashPickupCode).toHaveBeenCalledWith("4821");

      expect(prismaMock.pickupCode.upsert).toHaveBeenCalledWith({
        where: { order_id: "order-uuid-1" },
        create: expect.objectContaining({
          order_id: "order-uuid-1",
          code_hash: "mock_hmac_hash_4821",
          attempts: 0,
        }),
        update: expect.objectContaining({
          code_hash: "mock_hmac_hash_4821",
          attempts: 0,
        }),
      });

      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-uuid-1",
          recipientPhone: "0922334455",
          event: "buyer_order_ready",
          shopName: "Habesha Cafe",
          orderNumber: 1001,
          code: "4821",
        })
      );
    });

    it("transitions ready -> completed: commits state, creates order_event, revokes action tokens, sends NO SMS", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "ready" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "completed" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-4" });
      prismaMock.actionToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "completed",
        "seller_dash"
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("completed");

      expect(prismaMock.actionToken.updateMany).toHaveBeenCalledWith({
        where: { order_id: "order-uuid-1", revoked_at: null },
        data: expect.objectContaining({ revoked_at: expect.any(Date) }),
      });

      // No SMS sent for completion
      expect(smsOrchestratorMock.sendOrderSMS).not.toHaveBeenCalled();
    });
  });

  describe("Consent & Error Resilience", () => {
    it("respects buyer opt-out: transitions order normally, but SMS orchestrator skips message", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...mockOrderNew,
        state: "new",
        sms_consent: false,
      });
      prismaMock.order.update.mockResolvedValue({
        ...mockOrderNew,
        state: "accepted",
        sms_consent: false,
      });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-1" });

      smsOrchestratorMock.sendOrderSMS.mockResolvedValue({
        status: "skipped",
        skipReason: "opted_out",
      });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "accepted",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("accepted");
      expect(prismaMock.order.update).toHaveBeenCalled();
      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          smsConsent: false,
        })
      );
    });

    it("does not rollback database state when SMS dispatch fails", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "new" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "accepted" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-1" });

      smsOrchestratorMock.sendOrderSMS.mockResolvedValue({
        status: "failed",
        errorType: "CARRIER_DOWN",
      });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "accepted",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("accepted");
      expect(result.smsResult?.status).toBe("failed");
      expect(prismaMock.order.update).toHaveBeenCalled();
    });
  });

  describe("Pickup Code Reissue", () => {
    it("reissues pickup code for order in ready state and sends buyer_new_pickup_code SMS", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "ready" });
      prismaMock.pickupCode.update.mockResolvedValue({ id: "pickup-1", attempts: 0 });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-reissue" });
      cryptoServiceMock.generatePickupCode.mockReturnValue("7305");
      cryptoServiceMock.hashPickupCode.mockReturnValue("mock_hmac_hash_7305");

      const result = await service.reissuePickupCode("order-uuid-1", "seller_dash");

      expect(result.success).toBe(true);
      expect(result.pickupCode).toBe("7305");

      expect(prismaMock.pickupCode.update).toHaveBeenCalledWith({
        where: { order_id: "order-uuid-1" },
        data: expect.objectContaining({
          code_hash: "mock_hmac_hash_7305",
          attempts: 0,
        }),
      });

      expect(prismaMock.orderEvent.create).toHaveBeenCalledWith({
        data: {
          order_id: "order-uuid-1",
          from_state: "ready",
          to_state: "ready",
          actor: "seller_dash",
        },
      });

      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order-uuid-1",
          event: "buyer_new_pickup_code",
          shopName: "Habesha Cafe",
          orderNumber: 1001,
          code: "7305",
        })
      );
    });

    it("throws ConflictException when reissuing pickup code for order not in ready state", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "accepted" });

      await expect(
        service.reissuePickupCode("order-uuid-1", "seller_dash")
      ).rejects.toThrow(ConflictException);

      expect(prismaMock.pickupCode.update).not.toHaveBeenCalled();
      expect(smsOrchestratorMock.sendOrderSMS).not.toHaveBeenCalled();
    });
  });

  describe("Standalone transitionOrderState Helper (src/services/order.ts)", () => {
    it("delegates to OrdersService instance when passed", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "new" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "accepted" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-1" });

      const result = await transitionOrderState(
        "order-uuid-1",
        "accepted",
        "seller_link",
        undefined,
        service
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("accepted");
      expect(prismaMock.order.update).toHaveBeenCalled();
    });
  });
});
