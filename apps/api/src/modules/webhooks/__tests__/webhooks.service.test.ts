import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { WebhooksService, sanitizeWebhookPayload } from "../webhooks.service";
import { PrismaService } from "../../../prisma/prisma.service";

describe("WebhooksService (BE-014 - Webhook Event Ingestion & Message Status Synchronizer)", () => {
  let service: WebhooksService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      messageEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      message: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  describe("sanitizeWebhookPayload()", () => {
    it("redacts code, otp, and token fields in nested payload objects", () => {
      const payload = {
        event: "verification.sent",
        data: {
          code: "123456",
          otp: "654321",
          pickup_code: "4821",
          token: "secret-token-xyz",
        },
      };

      const resultStr = sanitizeWebhookPayload(payload);
      const parsed = JSON.parse(resultStr);

      expect(parsed.data.code).toBe("[REDACTED]");
      expect(parsed.data.otp).toBe("[REDACTED]");
      expect(parsed.data.pickup_code).toBe("[REDACTED]");
      expect(parsed.data.token).toBe("[REDACTED]");
    });

    it("redacts sensitive codes embedded inside SMS text strings", () => {
      const payload = {
        event: "message.sent",
        data: {
          message_id: "msg_123",
          text: "Habesha Cafe: order #1001 is ready. Pickup code: 4821. Show it when you collect.",
        },
      };

      const resultStr = sanitizeWebhookPayload(payload);
      const parsed = JSON.parse(resultStr);

      expect(parsed.data.text).not.toContain("4821");
      expect(parsed.data.text).toContain("[REDACTED]");
    });
  });

  describe("handleSMSHubWebhook()", () => {
    it("acceptance criterion: ignores duplicates if delivery_id is already recorded in message_events", async () => {
      prismaMock.messageEvent.findUnique.mockResolvedValue({
        id: "event-1",
        delivery_id: "deliv-uuid-dup",
      });

      const result = await service.handleSMSHubWebhook({
        eventType: "message.sent",
        deliveryId: "deliv-uuid-dup",
        payload: {
          event: "message.sent",
          data: { message_id: "smshub-msg-123" },
        },
        rawBody: "{}",
      });

      expect(result.received).toBe(true);
      expect(result.duplicate).toBe(true);
      expect(prismaMock.message.update).not.toHaveBeenCalled();
      expect(prismaMock.messageEvent.create).not.toHaveBeenCalled();
    });

    it("acceptance criterion: on message.sent, updates messages.status = 'sent'", async () => {
      prismaMock.messageEvent.findUnique.mockResolvedValue(null);
      prismaMock.message.findUnique.mockResolvedValue({ id: "msg-db-1" });
      prismaMock.message.update.mockResolvedValue({});
      prismaMock.messageEvent.create.mockResolvedValue({});

      const result = await service.handleSMSHubWebhook({
        eventType: "message.sent",
        deliveryId: "deliv-uuid-001",
        payload: {
          event: "message.sent",
          data: { message_id: "smshub-msg-123" },
        },
        rawBody: JSON.stringify({
          event: "message.sent",
          data: { message_id: "smshub-msg-123" },
        }),
      });

      expect(result.received).toBe(true);
      expect(result.event).toBe("message.sent");
      expect(result.deliveryId).toBe("deliv-uuid-001");
      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "msg-db-1" },
          data: expect.objectContaining({ status: "sent" }),
        })
      );
      expect(prismaMock.messageEvent.create).toHaveBeenCalled();
    });

    it("acceptance criterion: on message.failed, updates messages.status = 'failed' with error_type", async () => {
      prismaMock.messageEvent.findUnique.mockResolvedValue(null);
      prismaMock.message.findUnique.mockResolvedValue({ id: "msg-db-2" });
      prismaMock.message.update.mockResolvedValue({});
      prismaMock.messageEvent.create.mockResolvedValue({});

      const result = await service.handleSMSHubWebhook({
        eventType: "message.failed",
        deliveryId: "deliv-uuid-002",
        payload: {
          event: "message.failed",
          data: { message_id: "smshub-msg-456", error_type: "carrier_rejection" },
        },
        rawBody: JSON.stringify({
          event: "message.failed",
          data: { message_id: "smshub-msg-456", error_type: "carrier_rejection" },
        }),
      });

      expect(result.received).toBe(true);
      expect(prismaMock.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "msg-db-2" },
          data: expect.objectContaining({
            status: "failed",
            error_type: "carrier_rejection",
          }),
        })
      );
    });

    it("acceptance criterion: strips sensitive text before saving to message_events.raw_payload", async () => {
      prismaMock.messageEvent.findUnique.mockResolvedValue(null);
      prismaMock.message.findUnique.mockResolvedValue(null);
      prismaMock.messageEvent.create.mockResolvedValue({});

      await service.handleSMSHubWebhook({
        eventType: "verification.sent",
        deliveryId: "deliv-uuid-003",
        payload: {
          data: { code: "123456", text: "Your pickup code is 9876." },
        },
        rawBody: JSON.stringify({ data: { code: "123456", text: "Your pickup code is 9876." } }),
      });

      expect(prismaMock.messageEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            raw_payload: expect.not.stringContaining("9876"),
          }),
        })
      );
      expect(prismaMock.messageEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            raw_payload: expect.not.stringContaining("123456"),
          }),
        })
      );
    });

    it("treats P2002 duplicate key constraint race condition as idempotent success", async () => {
      prismaMock.messageEvent.findUnique.mockResolvedValue(null);
      prismaMock.message.findUnique.mockResolvedValue(null);
      const p2002Err: any = new Error("Unique constraint failed");
      p2002Err.code = "P2002";
      prismaMock.messageEvent.create.mockRejectedValue(p2002Err);

      const result = await service.handleSMSHubWebhook({
        eventType: "message.sent",
        deliveryId: "deliv-race-1",
        payload: { data: { message_id: "msg_race" } },
        rawBody: "{}",
      });

      expect(result.received).toBe(true);
      expect(result.duplicate).toBe(true);
    });
  });
});
