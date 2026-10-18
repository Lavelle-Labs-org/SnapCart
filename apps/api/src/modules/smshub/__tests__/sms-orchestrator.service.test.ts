import { describe, it, expect, beforeEach, vi } from "vitest";
import { SMSOrchestratorService } from "../sms-orchestrator.service";
import { SMSHubError } from "../smshub.service";

describe("SMSOrchestratorService (BE-007)", () => {
  let service: SMSOrchestratorService;
  let prismaMock: any;
  let smshubMock: any;

  beforeEach(() => {
    prismaMock = {
      suppressionList: {
        findUnique: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
      },
      message: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "msg-db-uuid-1",
            created_at: new Date(),
            ...data,
          })
        ),
      },
    };

    smshubMock = {
      sendSMS: vi.fn(),
    };

    service = new SMSOrchestratorService(prismaMock, smshubMock);
  });

  describe("Suppression List Enforcement", () => {
    it("skips dispatch and logs status 'skipped' with skip_reason 'opted_out' when phone is in suppression_list", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue({
        id: "sup-1",
        phone: "0911223344",
        reason: "buyer_opt_out",
      });

      const res = await service.sendOrderSMS({
        orderId: "order-1",
        sellerId: "seller-1",
        recipientPhone: "+251911223344",
        event: "buyer_order_accepted",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        link: "https://ord.et/x/test",
      });

      expect(prismaMock.suppressionList.findUnique).toHaveBeenCalledWith({
        where: { phone: "0911223344" },
      });
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipient_phone: "0911223344",
          status: "skipped",
          skip_reason: "opted_out",
          attempts: 0,
        }),
      });
      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("opted_out");
    });
  });

  describe("Customer SMS Consent Enforcement", () => {
    it("skips dispatch and logs 'skipped' when buyer sms_consent is false in options", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);

      const res = await service.sendOrderSMS({
        orderId: "order-1",
        sellerId: "seller-1",
        recipientPhone: "0911223344",
        event: "buyer_order_accepted",
        smsConsent: false,
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "skipped",
          skip_reason: "opted_out",
        }),
      });
      expect(res.status).toBe("skipped");
    });

    it("fetches order from database and skips if order.sms_consent is false", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.order.findUnique.mockResolvedValue({
        id: "order-1",
        sms_consent: false,
      });

      const res = await service.sendOrderSMS({
        orderId: "order-1",
        sellerId: "seller-1",
        recipientPhone: "0911223344",
        event: "buyer_order_ready",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        code: "4821",
      });

      expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
        where: { id: "order-1" },
      });
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(res.status).toBe("skipped");
    });

    it("does NOT require buyer consent for seller alert events", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          message_id: "msg_seller_1",
          credits_used: 1,
          network: "ethio_telecom",
        },
      });

      const res = await service.sendOrderSMS({
        orderId: "order-1",
        sellerId: "seller-1",
        recipientPhone: "0911223344",
        event: "seller_new_order",
        smsConsent: false, // Seller alert ignores buyer consent
        orderNumber: 1001,
        itemCount: 2,
        totalBirr: 500,
        link: "https://ord.et/a/test",
      });

      expect(smshubMock.sendSMS).toHaveBeenCalledTimes(1);
      expect(res.status).toBe("sent");
      expect(res.smshubMessageId).toBe("msg_seller_1");
    });
  });

  describe("Plain Code Masking in messages.text", () => {
    it("masks pickup code with '****' in stored messages.text while sending real code to SMSHub", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          message_id: "msg_ready_1",
          credits_used: 1,
          network: "ethio_telecom",
        },
      });

      const res = await service.sendOrderSMS({
        orderId: "order-1",
        sellerId: "seller-1",
        recipientPhone: "0911223344",
        event: "buyer_order_ready",
        smsConsent: true,
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        code: "4821",
      });

      // SMSHub must receive the real unmasked pickup code
      expect(smshubMock.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("4821"),
        })
      );

      // Stored message in database MUST have the pickup code masked
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          text: expect.stringContaining("Pickup code: ****"),
        }),
      });

      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          text: expect.stringContaining("4821"),
        }),
      });

      expect(res.text).toContain("Pickup code: ****");
      expect(res.text).not.toContain("4821");
    });

    it("masks reissued pickup code for buyer_new_pickup_code event", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          message_id: "msg_new_code_1",
          credits_used: 1,
          network: "ethio_telecom",
        },
      });

      const res = await service.sendOrderSMS({
        orderId: "order-1",
        sellerId: "seller-1",
        recipientPhone: "0911223344",
        event: "buyer_new_pickup_code",
        smsConsent: true,
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        code: "7305",
      });

      expect(smshubMock.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining("7305"),
        })
      );

      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          text: expect.stringContaining("is ****."),
        }),
      });
      expect(res.text).toContain("is ****.");
    });
  });

  describe("Successful Dispatch Audit Log", () => {
    it("records smshub_message_id, credits_used, network, and status 'sent'", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          message_id: "msg_accepted_999",
          credits_used: 2,
          network: "safaricom",
          request_id: "req_xyz_1",
        },
      });

      const res = await service.sendOrderSMS({
        orderId: "order-10",
        sellerId: "seller-5",
        recipientPhone: "+251711223344",
        event: "buyer_order_accepted",
        smsConsent: true,
        shopName: "Habesha Cafe",
        orderNumber: 1043,
        link: "https://ord.et/x/Z7y1",
      });

      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          seller_id: "seller-5",
          order_id: "order-10",
          recipient_phone: "0711223344",
          event: "buyer_order_accepted",
          status: "sent",
          smshub_message_id: "msg_accepted_999",
          credits_used: 2,
          network: "safaricom",
          request_id: "req_xyz_1",
          attempts: 1,
        }),
      });

      expect(res.status).toBe("sent");
      expect(res.creditsUsed).toBe(2);
      expect(res.smshubMessageId).toBe("msg_accepted_999");
    });

    it("records status 'test_passed' when SMSHub would_send is true (test mode)", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: {
          would_send: true,
          characters: 84,
          encoding: "GSM-7",
          message_id: "msg_test_mode_1",
        },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        orderNumber: 1001,
        itemCount: 1,
        totalBirr: 100,
        link: "https://ord.et/a/test",
      });

      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "test_passed",
        }),
      });
      expect(res.status).toBe("test_passed");
    });
  });

  describe("Failed Dispatch Handling", () => {
    it("records status 'failed' with error_type when SMSHub throws an error", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      const error = new SMSHubError({
        message: "SMSHub insufficient credits",
        status: 402,
        errorType: "INSUFFICIENT_CREDITS",
        requestId: "req_err_1",
      });
      smshubMock.sendSMS.mockRejectedValue(error);

      await expect(
        service.sendOrderSMS({
          recipientPhone: "0911223344",
          event: "seller_new_order",
          orderNumber: 1001,
          itemCount: 1,
          totalBirr: 100,
          link: "https://ord.et/a/test",
          throwOnError: true,
        })
      ).rejects.toThrow();

      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "failed",
          error_type: "INSUFFICIENT_CREDITS",
          request_id: "req_err_1",
          attempts: 1,
        }),
      });
    });

    it("returns status 'failed' without throwing when throwOnError is false", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      const error = new SMSHubError({
        message: "Network timeout",
        status: 504,
        errorType: "GATEWAY_TIMEOUT",
      });
      smshubMock.sendSMS.mockRejectedValue(error);

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "buyer_order_rejected",
        smsConsent: true,
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        throwOnError: false,
      });

      expect(res.status).toBe("failed");
      expect(res.errorType).toBe("GATEWAY_TIMEOUT");
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "failed",
          error_type: "GATEWAY_TIMEOUT",
        }),
      });
    });
  });

  describe("All 7 Events Support", () => {
    const testCases: { event: string; isBuyer: boolean }[] = [
      { event: "seller_new_order", isBuyer: false },
      { event: "buyer_order_accepted", isBuyer: true },
      { event: "buyer_order_rejected", isBuyer: true },
      { event: "buyer_order_ready", isBuyer: true },
      { event: "buyer_new_pickup_code", isBuyer: true },
      { event: "seller_phone_code", isBuyer: false },
      { event: "buyer_phone_code", isBuyer: false },
    ];

    for (const { event, isBuyer } of testCases) {
      it(`dispatches ${event} successfully`, async () => {
        prismaMock.suppressionList.findUnique.mockResolvedValue(null);
        smshubMock.sendSMS.mockResolvedValue({
          status: "success",
          data: {
            message_id: `msg_${event}`,
            credits_used: 1,
          },
        });

        const res = await service.sendOrderSMS({
          recipientPhone: "0911223344",
          event,
          smsConsent: isBuyer ? true : undefined,
          shopName: "Habesha Cafe",
          orderNumber: 1001,
          code: "1234",
          link: "https://ord.et/x/test",
        });

        expect(res.status).toBe("sent");
        expect(res.smshubMessageId).toBe(`msg_${event}`);
      });
    }
  });
});
