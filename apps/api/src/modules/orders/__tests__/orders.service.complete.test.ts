import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import { OrdersService } from "../orders.service";

describe("OrdersService - Pickup Code Verification & Handover Completion (BE-012)", () => {
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

  const mockOrderReady = {
    id: "order-uuid-1",
    seller_id: "seller-123",
    number: 1001,
    buyer_name: "Abebe Kebede",
    buyer_phone: "0922334455",
    sms_consent: true,
    state: "ready",
    total_santim: 45000,
    created_at: new Date(),
    seller: mockSeller,
  };

  const mockPickupRecord = {
    id: "pickup-uuid-1",
    order_id: "order-uuid-1",
    code_hash: "mock_hmac_hash_4821",
    expires_at: new Date(Date.now() + 86400000), // 1 day future
    attempts: 0,
    issued_at: new Date(),
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
        findUnique: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
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

  describe("completeWithPickupCode", () => {
    it("throws NotFoundException if order does not exist", async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);

      await expect(
        service.completeWithPickupCode("non-existent-order", "4821", "seller_link")
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException if order is not in ready state", async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        ...mockOrderReady,
        state: "accepted",
      });

      await expect(
        service.completeWithPickupCode("order-uuid-1", "4821", "seller_link")
      ).rejects.toThrow(ConflictException);
    });

    it("throws BadRequestException if pickup code record is not found", async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderReady);
      prismaMock.pickupCode.findUnique.mockResolvedValue(null);

      await expect(
        service.completeWithPickupCode("order-uuid-1", "4821", "seller_link")
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects as locked when attempts >= 5", async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderReady);
      prismaMock.pickupCode.findUnique.mockResolvedValue({
        ...mockPickupRecord,
        attempts: 5,
      });

      try {
        await service.completeWithPickupCode("order-uuid-1", "4821", "seller_link");
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        const res = err.getResponse();
        expect(res.code).toBe("PICKUP_CODE_LOCKED");
        expect(res.isLocked).toBe(true);
        expect(res.remainingAttempts).toBe(0);
      }
    });

    it("rejects as expired when expires_at is in the past", async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderReady);
      prismaMock.pickupCode.findUnique.mockResolvedValue({
        ...mockPickupRecord,
        expires_at: new Date(Date.now() - 1000), // expired
      });

      try {
        await service.completeWithPickupCode("order-uuid-1", "4821", "seller_link");
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        const res = err.getResponse();
        expect(res.code).toBe("PICKUP_CODE_EXPIRED");
      }
    });

    it("increments attempts and returns remaining attempts on wrong code", async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderReady);
      prismaMock.pickupCode.findUnique.mockResolvedValue({
        ...mockPickupRecord,
        attempts: 2,
      });
      cryptoServiceMock.verifyPickupCodeHash.mockReturnValue(false);
      prismaMock.pickupCode.update.mockResolvedValue({
        ...mockPickupRecord,
        attempts: 3,
      });

      try {
        await service.completeWithPickupCode("order-uuid-1", "9999", "seller_link");
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        const res = err.getResponse();
        expect(res.code).toBe("INVALID_PICKUP_CODE");
        expect(res.remainingAttempts).toBe(2); // 5 - 3 = 2
        expect(res.isLocked).toBe(false);

        expect(prismaMock.pickupCode.update).toHaveBeenCalledWith({
          where: { order_id: "order-uuid-1" },
          data: { attempts: 3 },
        });
      }
    });

    it("marks isLocked = true when 5th wrong attempt is entered", async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderReady);
      prismaMock.pickupCode.findUnique.mockResolvedValue({
        ...mockPickupRecord,
        attempts: 4,
      });
      cryptoServiceMock.verifyPickupCodeHash.mockReturnValue(false);
      prismaMock.pickupCode.update.mockResolvedValue({
        ...mockPickupRecord,
        attempts: 5,
      });

      try {
        await service.completeWithPickupCode("order-uuid-1", "9999", "seller_link");
        expect.unreachable("Should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        const res = err.getResponse();
        expect(res.code).toBe("INVALID_PICKUP_CODE");
        expect(res.remainingAttempts).toBe(0);
        expect(res.isLocked).toBe(true);
      }
    });

    it("transitions order to completed and revokes action tokens when pickup code matches", async () => {
      prismaMock.order.findUnique.mockResolvedValue(mockOrderReady);
      prismaMock.pickupCode.findUnique.mockResolvedValue({
        ...mockPickupRecord,
        attempts: 1,
      });
      cryptoServiceMock.verifyPickupCodeHash.mockReturnValue(true);
      prismaMock.order.update.mockResolvedValue({
        ...mockOrderReady,
        state: "completed",
      });

      const result = await service.completeWithPickupCode(
        "order-uuid-1",
        "4821",
        "seller_link"
      );

      expect(result.success).toBe(true);
      expect(result.currentState).toBe("completed");
      expect(result.previousState).toBe("ready");

      // Verify order update committed to DB
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: "order-uuid-1" },
        data: { state: "completed" },
      });

      // Verify action tokens revoked
      expect(prismaMock.actionToken.updateMany).toHaveBeenCalledWith({
        where: { order_id: "order-uuid-1", revoked_at: null },
        data: expect.objectContaining({
          revoked_at: expect.any(Date),
        }),
      });

      // Verify order event created
      expect(prismaMock.orderEvent.create).toHaveBeenCalledWith({
        data: {
          order_id: "order-uuid-1",
          from_state: "ready",
          to_state: "completed",
          actor: "seller_link",
        },
      });

      // Terminal state completed triggers NO SMS
      expect(smsOrchestratorMock.sendOrderSMS).not.toHaveBeenCalled();
    });
  });
});
