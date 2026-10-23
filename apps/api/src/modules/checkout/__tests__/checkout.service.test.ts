import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { CheckoutService } from "../checkout.service";

describe("CheckoutService (BE-008)", () => {
  let service: CheckoutService;
  let prismaMock: any;
  let smshubMock: any;

  const mockSeller = {
    id: "seller-123",
    business_name: "Habesha Cafe & Roastery",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    slug: "habesha-cafe",
  };

  const mockProducts = [
    {
      id: "prod-1",
      seller_id: "seller-123",
      name: "Sidama Coffee",
      price_santim: 45000,
      available: true,
      deleted_at: null,
    },
    {
      id: "prod-2",
      seller_id: "seller-123",
      name: "Spiced Tea",
      price_santim: 5000,
      available: true,
      deleted_at: null,
    },
  ];

  beforeEach(() => {
    prismaMock = {
      seller: {
        findUnique: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      phoneVerification: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "draft-uuid-1",
            created_at: new Date(),
            ...data,
          })
        ),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "draft-uuid-1",
            ...data,
          })
        ),
      },
    };

    smshubMock = {
      verifySend: vi.fn(),
    };

    service = new CheckoutService(prismaMock, smshubMock);
  });

  describe("checkout", () => {
    it("rejects malformed or international phone numbers with 400", async () => {
      await expect(
        service.checkout({
          slug: "habesha-cafe",
          buyerName: "John Doe",
          buyerPhone: "+14155552671", // US number
          items: [{ productId: "prod-1", quantity: 1 }],
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });

      await expect(
        service.checkout({
          slug: "habesha-cafe",
          buyerName: "John Doe",
          buyerPhone: "12345", // Malformed
          items: [{ productId: "prod-1", quantity: 1 }],
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("rejects non-existent seller slug with 404", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(null);

      await expect(
        service.checkout({
          slug: "unknown-shop",
          buyerName: "Abebe",
          buyerPhone: "0911223344",
          items: [{ productId: "prod-1", quantity: 1 }],
        })
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("rejects empty cart items or invalid quantities with 400", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);

      await expect(
        service.checkout({
          slug: "habesha-cafe",
          buyerName: "Abebe",
          buyerPhone: "0911223344",
          items: [],
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });

      await expect(
        service.checkout({
          slug: "habesha-cafe",
          buyerName: "Abebe",
          buyerPhone: "0911223344",
          items: [{ productId: "prod-1", quantity: 0 }],
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("rejects when product is unavailable or belongs to another seller", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);
      // Return only 1 product when 2 were requested
      prismaMock.product.findMany.mockResolvedValue([mockProducts[0]]);

      await expect(
        service.checkout({
          slug: "habesha-cafe",
          buyerName: "Abebe",
          buyerPhone: "0911223344",
          items: [
            { productId: "prod-1", quantity: 1 },
            { productId: "prod-missing", quantity: 1 },
          ],
        })
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("successfully creates draft with serialized cart items, calculates santim total, and sends OTP", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);
      prismaMock.product.findMany.mockResolvedValue(mockProducts);
      smshubMock.verifySend.mockResolvedValue({
        status: "success",
        data: {
          verification_id: "ver-smshub-123",
          expires_in: 300,
        },
      });

      const res = await service.checkout({
        slug: "habesha-cafe",
        buyerName: "Abebe Kebede",
        buyerPhone: "+251911223344", // Should be normalized to 0911223344
        smsConsent: true,
        consentWording: "Send me SMS updates about this order",
        items: [
          { productId: "prod-1", quantity: 2 }, // 45000 * 2 = 90000 santim
          { productId: "prod-2", quantity: 1 }, // 5000 * 1 = 5000 santim
        ],
      });

      // Verification with SMSHub verifySend
      expect(smshubMock.verifySend).toHaveBeenCalledWith(
        "0911223344",
        "Habesha Cafe",
        6,
        300
      );

      // Verify draft stored in phone_verifications
      expect(prismaMock.phoneVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phone: "0911223344",
          purpose: "buyer_checkout",
          verification_id: "ver-smshub-123",
          status: "pending",
          draft: expect.any(String),
        }),
      });

      // Verify serialized draft content
      const createCall = prismaMock.phoneVerification.create.mock.calls[0][0];
      const parsedDraft = JSON.parse(createCall.data.draft);
      expect(parsedDraft.sellerId).toBe("seller-123");
      expect(parsedDraft.buyerName).toBe("Abebe Kebede");
      expect(parsedDraft.buyerPhone).toBe("0911223344");
      expect(parsedDraft.smsConsent).toBe(true);
      expect(parsedDraft.totalSantim).toBe(95000); // 90000 + 5000
      expect(parsedDraft.items).toHaveLength(2);

      // Verify response
      expect(res.draftId).toBe("draft-uuid-1");
      expect(res.phone).toBe("0911223344");
      expect(res.expiresAt).toBeDefined();
    });
  });

  describe("resendCheckoutOtp", () => {
    it("throws 404 if draft does not exist", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(null);

      await expect(
        service.resendCheckoutOtp("non-existent-draft")
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it("throws 400 if verification status is not pending", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-1",
        purpose: "buyer_checkout",
        status: "approved",
        last_sent_at: new Date(Date.now() - 120 * 1000),
      });

      await expect(service.resendCheckoutOtp("draft-1")).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it("enforces 60-second cooldown and throws 429 when called too early", async () => {
      // Sent 25 seconds ago -> 35 seconds remaining
      const recentDate = new Date(Date.now() - 25 * 1000);
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-1",
        phone: "0911223344",
        purpose: "buyer_checkout",
        status: "pending",
        last_sent_at: recentDate,
        draft: JSON.stringify({ slug: "habesha-cafe" }),
      });

      await expect(service.resendCheckoutOtp("draft-1")).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
      expect(smshubMock.verifySend).not.toHaveBeenCalled();
    });

    it("successfully resends OTP when 60+ seconds have elapsed", async () => {
      // Sent 75 seconds ago -> cooldown passed
      const pastDate = new Date(Date.now() - 75 * 1000);
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-1",
        phone: "0911223344",
        purpose: "buyer_checkout",
        status: "pending",
        last_sent_at: pastDate,
        draft: JSON.stringify({ slug: "habesha-cafe", sellerId: "seller-123" }),
      });
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);
      smshubMock.verifySend.mockResolvedValue({
        status: "success",
        data: {
          verification_id: "ver-new-resend-456",
          expires_in: 300,
        },
      });

      const res = await service.resendCheckoutOtp("draft-1");

      expect(smshubMock.verifySend).toHaveBeenCalledWith(
        "0911223344",
        "Habesha Cafe",
        6,
        300
      );

      expect(prismaMock.phoneVerification.update).toHaveBeenCalledWith({
        where: { id: "draft-1" },
        data: expect.objectContaining({
          verification_id: "ver-new-resend-456",
          last_sent_at: expect.any(Date),
        }),
      });

      expect(res.sent).toBe(true);
      expect(res.retryAfter).toBe(60);
    });
  });
});
