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
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        findFirst: vi.fn(),
      },
      suppressionList: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
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
      generateActionToken: vi.fn().mockReturnValue("mock_stop_token_12345"),
      hashActionToken: vi.fn().mockReturnValue("mock_stop_token_hash_abc"),
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

  describe("BE-015: Buyer Stop Action Token Generation on Acceptance", () => {
    it("generates an action_tokens record with purpose 'buyer_stop' and includes stop link in SMS when accepted", async () => {
      prismaMock.order.findUnique.mockResolvedValue({ ...mockOrderNew, state: "new" });
      prismaMock.order.update.mockResolvedValue({ ...mockOrderNew, state: "accepted" });
      prismaMock.orderEvent.create.mockResolvedValue({ id: "event-1" });
      prismaMock.actionToken.create.mockResolvedValue({ id: "tok-1" });

      const result = await service.transitionOrderState(
        "order-uuid-1",
        "accepted",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.stopToken).toBe("mock_stop_token_12345");
      expect(cryptoServiceMock.generateActionToken).toHaveBeenCalled();
      expect(cryptoServiceMock.hashActionToken).toHaveBeenCalledWith("mock_stop_token_12345");
      expect(prismaMock.actionToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order_id: "order-uuid-1",
            purpose: "buyer_stop",
            token_hash: "mock_stop_token_hash_abc",
          }),
        })
      );
      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "buyer_order_accepted",
          link: expect.stringContaining("/x/mock_stop_token_12345"),
        })
      );
    });
  });

  describe("BE-015: Buyer Opt-Out & Suppression (optOutBuyer)", () => {
    const validStopToken = "valid_stop_token_12345";
    const stopTokenHash = "mock_stop_token_hash_abc";
    const mockOrderWithBuyer = {
      id: "order-uuid-1",
      number: 1043,
      buyer_phone: "0911223344",
      seller: { business_name: "Habesha Cafe", sms_name: "Habesha Cafe" },
    };

    it("verifies stop token, upserts into suppression_list, revokes token, and returns masked phone", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        id: "tok-uuid-1",
        order_id: "order-uuid-1",
        purpose: "buyer_stop",
        token_hash: stopTokenHash,
        expires_at: new Date(Date.now() + 1000000),
        revoked_at: null,
        order: mockOrderWithBuyer,
      });
      prismaMock.suppressionList.upsert.mockResolvedValue({ id: "sup-1" });
      prismaMock.actionToken.update.mockResolvedValue({});

      const result = await service.optOutBuyer(validStopToken);

      expect(cryptoServiceMock.hashActionToken).toHaveBeenCalledWith(validStopToken);
      expect(prismaMock.suppressionList.upsert).toHaveBeenCalledWith({
        where: { phone: "0911223344" },
        create: {
          phone: "0911223344",
          reason: "buyer_stop",
          order_id: "order-uuid-1",
          created_at: expect.any(Date),
        },
        update: {
          reason: "buyer_stop",
          order_id: "order-uuid-1",
        },
      });
      expect(prismaMock.actionToken.update).toHaveBeenCalledWith({
        where: { id: "tok-uuid-1" },
        data: { revoked_at: expect.any(Date) },
      });
      expect(result).toEqual({
        suppressed: true,
        phone: "09•• ••• 344",
      });
    });

    it("throws NotFoundException when stop token not found", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue(null);

      await expect(service.optOutBuyer("unknown_token")).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws NotFoundException when stop token has expired", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        id: "tok-uuid-1",
        order_id: "order-uuid-1",
        purpose: "buyer_stop",
        token_hash: stopTokenHash,
        expires_at: new Date(Date.now() - 10000),
        revoked_at: null,
        order: mockOrderWithBuyer,
      });

      await expect(service.optOutBuyer(validStopToken)).rejects.toThrow(
        NotFoundException
      );
    });

    it("throws NotFoundException when token purpose is not buyer_stop", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        id: "tok-uuid-1",
        order_id: "order-uuid-1",
        purpose: "seller_action",
        token_hash: stopTokenHash,
        expires_at: new Date(Date.now() + 1000000),
        revoked_at: null,
        order: mockOrderWithBuyer,
      });

      await expect(service.optOutBuyer(validStopToken)).rejects.toThrow(
        NotFoundException
      );
    });

    it("handles idempotent re-opt-out if token was already revoked and phone is already suppressed", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        id: "tok-uuid-1",
        order_id: "order-uuid-1",
        purpose: "buyer_stop",
        token_hash: stopTokenHash,
        expires_at: new Date(Date.now() + 1000000),
        revoked_at: new Date(Date.now() - 5000),
        order: mockOrderWithBuyer,
      });
      prismaMock.suppressionList.findUnique.mockResolvedValue({
        phone: "0911223344",
        reason: "buyer_stop",
      });

      const result = await service.optOutBuyer(validStopToken);

      expect(result).toEqual({
        suppressed: true,
        phone: "09•• ••• 344",
        alreadySuppressed: true,
      });
      expect(prismaMock.suppressionList.upsert).not.toHaveBeenCalled();
    });
  });

  describe("BE-015: Read-Only Stop Link Details (getStopTokenDetails)", () => {
    const validStopToken = "valid_stop_token_12345";
    const stopTokenHash = "mock_stop_token_hash_abc";
    const mockOrderWithBuyer = {
      id: "order-uuid-1",
      number: 1043,
      buyer_phone: "0911223344",
      seller: { business_name: "Habesha Cafe", sms_name: "Habesha Cafe" },
    };

    it("returns read-only preview metadata without modifying state", async () => {
      prismaMock.actionToken.findUnique.mockResolvedValue({
        id: "tok-uuid-1",
        order_id: "order-uuid-1",
        purpose: "buyer_stop",
        token_hash: stopTokenHash,
        expires_at: new Date(Date.now() + 1000000),
        revoked_at: null,
        order: mockOrderWithBuyer,
      });
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);

      const result = await service.getStopTokenDetails(validStopToken);

      expect(result).toEqual({
        valid: true,
        orderNumber: 1043,
        shopName: "Habesha Cafe",
        maskedPhone: "09•• ••• 344",
        alreadySuppressed: false,
      });
      expect(prismaMock.suppressionList.upsert).not.toHaveBeenCalled();
      expect(prismaMock.actionToken.update).not.toHaveBeenCalled();
    });
  });
});
