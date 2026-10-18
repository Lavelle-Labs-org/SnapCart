import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { WebhooksService } from "../webhooks.service";
import { PrismaService } from "../../../prisma/prisma.service";

describe("WebhooksService (apps/api - MIG-007)", () => {
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

  it("processes new webhook event and records delivery", async () => {
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

  it("handles duplicate delivery IDs idempotently without reprocessing", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue({
      id: "event-1",
      delivery_id: "deliv-uuid-001",
    });

    const result = await service.handleSMSHubWebhook({
      eventType: "message.sent",
      deliveryId: "deliv-uuid-001",
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

  it("updates message to failed status on message.failed event", async () => {
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

  it("redacts sensitive codes before persisting to message_events", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue(null);
    prismaMock.message.findUnique.mockResolvedValue(null);
    prismaMock.messageEvent.create.mockResolvedValue({});

    await service.handleSMSHubWebhook({
      eventType: "verification.sent",
      deliveryId: "deliv-uuid-003",
      payload: {
        data: { code: "123456", otp: "654321" },
      },
      rawBody: JSON.stringify({ data: { code: "123456", otp: "654321" } }),
    });

    expect(prismaMock.messageEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raw_payload: expect.stringContaining("[REDACTED]"),
        }),
      })
    );
  });
});
