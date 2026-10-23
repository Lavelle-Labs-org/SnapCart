import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SMSOrchestratorService } from "../sms-orchestrator.service";
import { SMSHubError } from "../smshub.service";

describe("SMSOrchestratorService (BE-007, BE-017)", () => {
  let service: SMSOrchestratorService;
  let prismaMock: any;
  let smshubMock: any;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SMS_SENDING_PAUSED;
    delete process.env.SMS_ALLOWLIST;
    delete process.env.SMS_DAILY_CAP;

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
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "msg-db-uuid-1",
            ...data,
          })
        ),
        findMany: vi.fn().mockResolvedValue([]),
      },
      rateCounter: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    smshubMock = {
      sendSMS: vi.fn(),
    };

    service = new SMSOrchestratorService(prismaMock, smshubMock);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
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

  describe("Sending Pause Guard (SMS_SENDING_PAUSED - BE-017)", () => {
    it("skips dispatch when SMS_SENDING_PAUSED='true' in process.env", async () => {
      process.env.SMS_SENDING_PAUSED = "true";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("sending_paused");
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "skipped",
          skip_reason: "sending_paused",
          attempts: 0,
        }),
      });
    });

    it("skips dispatch when sendingPaused option is true even if env is false", async () => {
      process.env.SMS_SENDING_PAUSED = "false";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        sendingPaused: true,
      });

      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("sending_paused");
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
    });

    it("proceeds with dispatch when SMS_SENDING_PAUSED is false or not set", async () => {
      process.env.SMS_SENDING_PAUSED = "false";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "msg-123", credits_used: 1 },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("sent");
      expect(smshubMock.sendSMS).toHaveBeenCalled();
    });
  });

  describe("Allowlist Guard (SMS_ALLOWLIST - BE-017)", () => {
    it("skips dispatch when recipient phone is not in SMS_ALLOWLIST", async () => {
      process.env.SMS_ALLOWLIST = "0911000000, 0922000000";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);

      const res = await service.sendOrderSMS({
        recipientPhone: "0933000000",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("not_allowlisted");
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "skipped",
          skip_reason: "not_allowlisted",
          attempts: 0,
        }),
      });
    });

    it("allows dispatch when recipient phone is in SMS_ALLOWLIST (supporting e164 / local format matching)", async () => {
      process.env.SMS_ALLOWLIST = "+251911000000, 0922000000";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "msg-allowlisted", credits_used: 1 },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911000000",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("sent");
      expect(smshubMock.sendSMS).toHaveBeenCalled();
    });

    it("respects allowlist provided in options override", async () => {
      process.env.SMS_ALLOWLIST = "0911000000"; // not in env
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "msg-custom-allowlist", credits_used: 1 },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0999999999",
        allowlist: "0999999999, 0988888888",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("sent");
      expect(smshubMock.sendSMS).toHaveBeenCalled();
    });

    it("allows all dispatches when SMS_ALLOWLIST is empty or undefined", async () => {
      delete process.env.SMS_ALLOWLIST;
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "msg-all", credits_used: 1 },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("sent");
    });
  });

  describe("Daily Budget Cap Guard (SMS_DAILY_CAP - BE-017)", () => {
    it("skips dispatch when daily SMS count meets or exceeds SMS_DAILY_CAP", async () => {
      process.env.SMS_DAILY_CAP = "50";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.rateCounter.findUnique.mockImplementation(({ where }: any) => {
        if (where.key.startsWith("sms_daily:")) {
          return Promise.resolve({
            key: where.key,
            window_start: new Date(),
            count: 50,
          });
        }
        return Promise.resolve(null);
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("daily_cap_exceeded");
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "skipped",
          skip_reason: "daily_cap_exceeded",
          attempts: 0,
        }),
      });
    });

    it("allows dispatch when daily count is below SMS_DAILY_CAP", async () => {
      process.env.SMS_DAILY_CAP = "50";
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.rateCounter.findUnique.mockImplementation(({ where }: any) => {
        if (where.key.startsWith("sms_daily:")) {
          return Promise.resolve({
            key: where.key,
            window_start: new Date(),
            count: 49,
          });
        }
        return Promise.resolve(null);
      });
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "msg-daily-ok", credits_used: 1 },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("sent");
      expect(smshubMock.sendSMS).toHaveBeenCalled();
    });

    it("respects dailyCap provided in options override", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.rateCounter.findUnique.mockImplementation(({ where }: any) => {
        if (where.key.startsWith("sms_daily:")) {
          return Promise.resolve({
            key: where.key,
            window_start: new Date(),
            count: 10,
          });
        }
        return Promise.resolve(null);
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        dailyCap: 10, // cap is 10, count is 10 -> exceeded
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("daily_cap_exceeded");
    });
  });

  describe("Recipient Phone Rate Limiter (BE-017)", () => {
    it("skips dispatch when recipient phone exceeds 5 sends per hour", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.rateCounter.findUnique.mockResolvedValue({
        key: "rate:phone:0911223344",
        window_start: new Date(), // current window
        count: 5,
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("skipped");
      expect(res.skipReason).toBe("rate_limited");
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "skipped",
          skip_reason: "rate_limited",
          attempts: 0,
        }),
      });
    });

    it("allows dispatch when recipient phone is below the hourly limit and records counter", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.rateCounter.findUnique.mockResolvedValue(null); // No prior counter
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "msg-rate-ok", credits_used: 1 },
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
      });

      expect(res.status).toBe("sent");
      expect(smshubMock.sendSMS).toHaveBeenCalled();
      // Counter recording
      expect(prismaMock.rateCounter.upsert).toHaveBeenCalled();
    });
  });

  describe("Asynchronous Background Queue Dispatch (PR-014, Issue #133)", () => {
    it("persists message intent with status 'queued' and offloads gateway dispatch to background", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.message.create.mockResolvedValue({
        id: "msg-queued-1",
        status: "queued",
        attempts: 0,
      });
      smshubMock.sendSMS.mockImplementation(async () => {
        // Simulate latent carrier response (>100ms) to ensure background offloading
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          status: "success",
          data: { message_id: "smshub-async-1", credits_used: 1, network: "ethio_telecom" },
        };
      });

      const res = await service.sendOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        async: true,
      });

      expect(res.status).toBe("queued");
      expect(res.messageId).toBe("msg-queued-1");
      expect(prismaMock.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipient_phone: "0911223344",
          status: "queued",
          attempts: 0,
        }),
      });

      // Wait for background promise to complete
      await new Promise((resolve) => setTimeout(resolve, 180));

      expect(smshubMock.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          msisdn: "0911223344",
        })
      );
      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "msg-queued-1" },
          data: expect.objectContaining({
            status: "sent",
            smshub_message_id: "smshub-async-1",
          }),
        })
      );
    });

    it("queueOrderSMS enqueues message with status 'queued' and returns immediately", async () => {
      prismaMock.suppressionList.findUnique.mockResolvedValue(null);
      prismaMock.message.create.mockResolvedValue({
        id: "msg-queued-2",
        status: "queued",
        attempts: 0,
      });
      smshubMock.sendSMS.mockImplementation(async () => {
        // Simulate latent carrier response (>100ms) to ensure background offloading
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          status: "success",
          data: { would_send: true, message_id: "smshub-test-2" },
        };
      });

      const res = await service.queueOrderSMS({
        recipientPhone: "0911223344",
        event: "seller_new_order",
        shopName: "Habesha Cafe",
        orderNumber: 1002,
      });

      expect(res.status).toBe("queued");
      expect(res.messageId).toBe("msg-queued-2");

      // Wait for background promise to complete
      await new Promise((resolve) => setTimeout(resolve, 180));

      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "msg-queued-2" },
          data: expect.objectContaining({
            status: "test_passed",
          }),
        })
      );
    });

    it("processPendingQueue processes unhandled queued messages from database", async () => {
      prismaMock.message.findMany.mockResolvedValue([
        {
          id: "pending-1",
          recipient_phone: "0911223344",
          event: "seller_new_order",
          text: "Order #1003 alert",
          status: "queued",
          attempts: 0,
        },
      ]);
      smshubMock.sendSMS.mockResolvedValue({
        status: "success",
        data: { message_id: "smshub-worker-1" },
      });

      const count = await service.processPendingQueue();
      expect(count).toBe(1);
      expect(prismaMock.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "queued" }),
        })
      );
      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pending-1" },
          data: expect.objectContaining({ status: "sent" }),
        })
      );
    });
  });
});
