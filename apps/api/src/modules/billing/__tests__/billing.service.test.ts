import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillingService } from "../billing.service";

describe("BillingService", () => {
  let billingService: BillingService;
  let chapaServiceMock: any;
  let prismaMock: any;

  beforeEach(() => {
    chapaServiceMock = {
      initializeTransaction: vi.fn(),
      verifyTransaction: vi.fn(),
      verifyWebhookSignature: vi.fn(),
    };

    prismaMock = {
      seller: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      paymentTransaction: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prismaMock)),
    };

    billingService = new BillingService(prismaMock as any, chapaServiceMock as any);
  });

  describe("getBalance", () => {
    it("returns correct balance and active status when credits > 3", async () => {
      prismaMock.seller.findUnique.mockResolvedValue({
        sms_credits: 10,
        sms_credits_used: 2,
      });

      const res = await billingService.getBalance("seller-1");
      expect(res.smsCredits).toBe(10);
      expect(res.smsCreditsUsed).toBe(2);
      expect(res.lowBalance).toBe(false);
      expect(res.isOutOfCredits).toBe(false);
    });

    it("flags lowBalance when credits <= 3 and > 0", async () => {
      prismaMock.seller.findUnique.mockResolvedValue({
        sms_credits: 2,
        sms_credits_used: 8,
      });

      const res = await billingService.getBalance("seller-1");
      expect(res.smsCredits).toBe(2);
      expect(res.lowBalance).toBe(true);
      expect(res.isOutOfCredits).toBe(false);
    });

    it("flags isOutOfCredits when credits <= 0", async () => {
      prismaMock.seller.findUnique.mockResolvedValue({
        sms_credits: 0,
        sms_credits_used: 10,
      });

      const res = await billingService.getBalance("seller-1");
      expect(res.smsCredits).toBe(0);
      expect(res.lowBalance).toBe(false);
      expect(res.isOutOfCredits).toBe(true);
    });
  });

  describe("initializeCheckout", () => {
    it("creates pending transaction and initializes Chapa session", async () => {
      const seller = {
        id: "seller-123",
        business_name: "Habesha Coffee",
        phone: "0911223344",
        slug: "habesha-coffee",
      };
      prismaMock.seller.findUnique.mockResolvedValue(seller);
      prismaMock.paymentTransaction.create.mockResolvedValue({ id: "tx-1" });
      chapaServiceMock.initializeTransaction.mockResolvedValue({
        status: "success",
        checkoutUrl: "https://checkout.chapa.co/pay/123",
      });

      const res = await billingService.initializeCheckout(seller.id, "growth_200");

      expect(res.checkoutUrl).toBe("https://checkout.chapa.co/pay/123");
      expect(res.txRef).toMatch(/^obs_/);
      expect(chapaServiceMock.initializeTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Growth Pack",
        })
      );
      expect(prismaMock.paymentTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          seller_id: "seller-123",
          package_id: "growth_200",
          credits_added: 200,
          amount_etb: 180,
          status: "pending",
        }),
      });
    });

    it("throws error for invalid package ID", async () => {
      await expect(
        billingService.initializeCheckout("seller-123", "invalid_pkg")
      ).rejects.toThrow("Invalid package ID");
    });
  });

  describe("processWebhookEvent", () => {
    it("atomically increments seller credits upon successful webhook", async () => {
      const pendingTx = {
        id: "tx-uuid-1",
        seller_id: "seller-123",
        tx_ref: "obs_12345",
        credits_added: 200,
        status: "pending",
      };
      prismaMock.paymentTransaction.findUnique.mockResolvedValue(pendingTx);
      prismaMock.paymentTransaction.update.mockResolvedValue({
        ...pendingTx,
        status: "completed",
      });
      prismaMock.seller.update.mockResolvedValue({
        id: "seller-123",
        sms_credits: 205,
      });

      const res = await billingService.processWebhookEvent({
        tx_ref: "obs_12345",
        status: "success",
        reference: "chapa_ref_999",
        payment_method: "telebirr",
      });

      expect(res.processed).toBe(true);
      expect(prismaMock.paymentTransaction.update).toHaveBeenCalledWith({
        where: { id: "tx-uuid-1" },
        data: {
          status: "completed",
          chapa_reference: "chapa_ref_999",
          payment_method: "telebirr",
        },
      });
      expect(prismaMock.seller.update).toHaveBeenCalledWith({
        where: { id: "seller-123" },
        data: {
          sms_credits: { increment: 200 },
        },
      });
    });

    it("handles already completed transactions idempotently", async () => {
      prismaMock.paymentTransaction.findUnique.mockResolvedValue({
        id: "tx-uuid-1",
        status: "completed",
      });

      const res = await billingService.processWebhookEvent({
        tx_ref: "obs_12345",
        status: "success",
      });

      expect(res.processed).toBe(true);
      expect(res.reason).toBe("Already completed");
      expect(prismaMock.seller.update).not.toHaveBeenCalled();
    });
  });
});
