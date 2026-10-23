import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import { CheckoutService } from "../checkout.service";

describe("CheckoutService - verifyCheckout (BE-009)", () => {
  let service: CheckoutService;
  let prismaMock: any;
  let smshubMock: any;
  let smsOrchestratorMock: any;
  let cryptoMock: any;

  const mockSeller = {
    id: "seller-123",
    business_name: "Habesha Roastery",
    sms_name: "Habesha",
    phone: "0911223344",
    slug: "habesha-roasts",
  };

  const mockDraft = {
    sellerId: mockSeller.id,
    slug: mockSeller.slug,
    buyerName: "Dawit Abebe",
    buyerPhone: "0922334455",
    smsConsent: true,
    consentWording: "Send me SMS updates about this order",
    totalSantim: 45000,
    items: [
      {
        productId: "prod-1",
        name: "Yirgacheffe Coffee",
        unitPriceSantim: 45000,
        quantity: 1,
      },
    ],
  };

  const mockVerification = {
    id: "draft-uuid-1",
    phone: "0922334455",
    purpose: "buyer_checkout",
    verification_id: "ver-hub-123",
    status: "pending",
    expires_at: new Date(Date.now() + 200 * 1000),
    last_sent_at: new Date(),
    draft: JSON.stringify(mockDraft),
  };

  beforeEach(() => {
    prismaMock = {
      phoneVerification: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      seller: {
        findUnique: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      order: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
    };

    smshubMock = {
      verifySend: vi.fn(),
      verifyCheck: vi.fn(),
    };

    smsOrchestratorMock = {
      sendOrderSMS: vi.fn(),
    };

    cryptoMock = {
      generateActionToken: vi.fn().mockReturnValue("abcdefghij123456789012"), // 22 chars
      hashActionToken: vi.fn().mockReturnValue("mock_sha256_hash_of_action_token"),
    };

    service = new CheckoutService(
      prismaMock,
      smshubMock,
      smsOrchestratorMock,
      cryptoMock
    );
  });

  describe("OTP Verification & Validation", () => {
    it("fails with 404 when draftId does not exist", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyCheckout({
          draftId: "non-existent",
          code: "123456",
        })
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("fails with 400 when draft is already approved or not pending", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        ...mockVerification,
        status: "approved",
      });

      await expect(
        service.verifyCheckout({
          draftId: mockVerification.id,
          code: "123456",
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("fails with 400 when OTP code is invalid or expired via SMSHub verifyCheck", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(mockVerification);
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: {
          valid: false,
          verification_status: "failed",
        },
      });

      await expect(
        service.verifyCheckout({
          draftId: mockVerification.id,
          code: "999999",
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });

      expect(smshubMock.verifyCheck).toHaveBeenCalledWith("ver-hub-123", "999999");
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("Atomic Order Creation & Action Token Generation", () => {
    it("starts order numbering at 1001 for seller's first order", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(mockVerification);
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: {
          valid: true,
          verification_status: "approved",
        },
      });

      // No previous orders for this seller
      prismaMock.order.findFirst.mockResolvedValue(null);
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Yirgacheffe Coffee",
          price_santim: 45000,
        },
      ]);
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);

      const createdOrder = {
        id: "order-uuid-1",
        seller_id: mockSeller.id,
        number: 1001,
        buyer_name: "Dawit Abebe",
        buyer_phone: "0922334455",
        sms_consent: true,
        consent_wording: "Send me SMS updates about this order",
        consent_at: new Date(),
        state: "new",
        total_santim: 45000,
        created_at: new Date("2026-10-18T12:00:00Z"),
        order_items: [
          {
            id: "item-1",
            order_id: "order-uuid-1",
            product_id: "prod-1",
            name_at_order: "Yirgacheffe Coffee",
            unit_price_santim: 45000,
            quantity: 1,
          },
        ],
      };
      prismaMock.order.create.mockResolvedValue(createdOrder);

      const result = await service.verifyCheckout({
        draftId: mockVerification.id,
        code: "482190",
      });

      // Verify transaction executed
      expect(prismaMock.$transaction).toHaveBeenCalled();

      // Verify order created with 1001
      expect(prismaMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: 1001,
            seller_id: mockSeller.id,
            state: "new",
            total_santim: 45000,
          }),
        })
      );

      // Verify 22-character action token was generated and SHA-256 hashed
      expect(cryptoMock.generateActionToken).toHaveBeenCalled();
      expect(cryptoMock.hashActionToken).toHaveBeenCalledWith("abcdefghij123456789012");
      expect(prismaMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action_tokens: {
              create: expect.objectContaining({
                purpose: "seller_action",
                token_hash: "mock_sha256_hash_of_action_token",
              }),
            },
          }),
        })
      );

      // Verify verification status marked approved
      expect(prismaMock.phoneVerification.update).toHaveBeenCalledWith({
        where: { id: mockVerification.id },
        data: { status: "approved" },
      });

      // Verify seller alert SMS dispatched
      expect(smsOrchestratorMock.sendOrderSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: mockSeller.id,
          orderId: "order-uuid-1",
          recipientPhone: mockSeller.phone,
          event: "seller_new_order",
          orderNumber: 1001,
          link: expect.stringContaining("/a/abcdefghij123456789012"),
        })
      );

      // Verify return format
      expect(result.orderNumber).toBe(1001);
      expect(result.orderId).toBe("order-uuid-1");
      expect(result.order.number).toBe(1001);
    });

    it("increments order number from previous highest order for the seller", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(mockVerification);
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: {
          valid: true,
          verification_status: "approved",
        },
      });

      // Previous highest order was #1042
      prismaMock.order.findFirst.mockResolvedValue({ number: 1042 });
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Yirgacheffe Coffee",
          price_santim: 45000,
        },
      ]);
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);

      prismaMock.order.create.mockResolvedValue({
        id: "order-uuid-2",
        seller_id: mockSeller.id,
        number: 1043,
        buyer_name: "Dawit Abebe",
        buyer_phone: "0922334455",
        sms_consent: true,
        consent_wording: "Send me SMS updates about this order",
        state: "new",
        total_santim: 45000,
        created_at: new Date(),
        order_items: [],
      });

      const result = await service.verifyCheckout({
        draftId: mockVerification.id,
        code: "482190",
      });

      expect(prismaMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: 1043,
          }),
        })
      );
      expect(result.orderNumber).toBe(1043);
    });

    it("retries on P2002 order number collision and allocates the next sequential number", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(mockVerification);
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: {
          valid: true,
          verification_status: "approved",
        },
      });

      // On attempt 1, highest order is 1005. Both transactions try 1006.
      // Attempt 1 fails with P2002 unique constraint collision.
      // On attempt 2, another transaction committed 1006, so findFirst returns 1006.
      // Attempt 2 creates 1007 successfully.
      let findFirstCalls = 0;
      prismaMock.order.findFirst.mockImplementation(async () => {
        findFirstCalls++;
        if (findFirstCalls === 1) {
          return { number: 1005 };
        }
        return { number: 1006 };
      });

      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          name: "Yirgacheffe Coffee",
          price_santim: 45000,
        },
      ]);
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);

      let createCalls = 0;
      prismaMock.order.create.mockImplementation(async ({ data }: any) => {
        createCalls++;
        if (createCalls === 1) {
          const p2002Err: any = new Error(
            "Unique constraint failed on the fields: (`seller_id`, `number`)"
          );
          p2002Err.code = "P2002";
          throw p2002Err;
        }
        return {
          id: "order-uuid-retry",
          seller_id: mockSeller.id,
          number: data.number,
          buyer_name: "Dawit Abebe",
          buyer_phone: "0922334455",
          sms_consent: true,
          consent_wording: "Send me SMS updates about this order",
          state: "new",
          total_santim: 45000,
          created_at: new Date(),
          order_items: [],
        };
      });

      const result = await service.verifyCheckout({
        draftId: mockVerification.id,
        code: "482190",
      });

      expect(createCalls).toBe(2);
      expect(result.orderNumber).toBe(1007);
    });
  });
});
