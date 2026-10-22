import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import crypto from "crypto";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("NestJS SMSHub Webhook API E2E (BE-014)", () => {
  let app: INestApplication;
  let prismaMock: any;
  const WEBHOOK_SECRET = "test_webhook_secret_for_e2e_testing";

  beforeAll(async () => {
    process.env.SMSHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SMSHUB_API_KEY = "test_api_key_for_webhooks_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      messageEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      message: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api", {
      exclude: ["webhooks/smshub", "webhooks/(.*)"],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function generateSignature(bodyStr: string, timestamp: number, secret: string = WEBHOOK_SECRET): string {
    const data = `${timestamp}.${bodyStr}`;
    const hash = crypto.createHmac("sha256", secret).update(data).digest("hex");
    return `t=${timestamp},v1=${hash}`;
  }

  it("POST /webhooks/smshub accepts valid signature and returns fast 200 acknowledgment", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue(null);
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg-1" });
    prismaMock.message.update.mockResolvedValue({});
    prismaMock.messageEvent.create.mockResolvedValue({});

    const bodyObj = {
      event: "message.sent",
      data: { message_id: "smshub_12345", status: "sent" },
    };
    const bodyStr = JSON.stringify(bodyObj);
    const now = Math.floor(Date.now() / 1000);
    const signature = generateSignature(bodyStr, now);

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", signature)
      .set("X-SMSHub-Event", "message.sent")
      .set("X-SMSHub-Delivery", "deliv-uuid-fresh-1")
      .send(bodyStr)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toBe(true);
    expect(res.body.data.event).toBe("message.sent");
    expect(res.body.data.deliveryId).toBe("deliv-uuid-fresh-1");

    expect(prismaMock.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1" },
        data: expect.objectContaining({ status: "sent" }),
      })
    );
  });

  it("updates message to failed status with error_type on message.failed event", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue(null);
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg-failed-1" });
    prismaMock.message.update.mockResolvedValue({});
    prismaMock.messageEvent.create.mockResolvedValue({});

    const bodyObj = {
      event: "message.failed",
      data: {
        message_id: "smshub_fail_999",
        error_type: "insufficient_credits",
      },
    };
    const bodyStr = JSON.stringify(bodyObj);
    const now = Math.floor(Date.now() / 1000);
    const signature = generateSignature(bodyStr, now);

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", signature)
      .set("X-SMSHub-Event", "message.failed")
      .set("X-SMSHub-Delivery", "deliv-fail-1")
      .send(bodyStr)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prismaMock.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-failed-1" },
        data: expect.objectContaining({
          status: "failed",
          error_type: "insufficient_credits",
        }),
      })
    );
  });

  it("strips sensitive codes from payload before persisting to message_events", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue(null);
    prismaMock.message.findUnique.mockResolvedValue(null);
    prismaMock.messageEvent.create.mockResolvedValue({});

    const bodyObj = {
      event: "message.sent",
      data: {
        message_id: "smshub_sec_1",
        code: "4821",
        text: "Habesha Cafe: order #1001 is ready. Pickup code: 4821.",
      },
    };
    const bodyStr = JSON.stringify(bodyObj);
    const now = Math.floor(Date.now() / 1000);
    const signature = generateSignature(bodyStr, now);

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", signature)
      .set("X-SMSHub-Event", "message.sent")
      .set("X-SMSHub-Delivery", "deliv-sec-1")
      .send(bodyStr)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(prismaMock.messageEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          raw_payload: expect.not.stringContaining("4821"),
        }),
      })
    );
  });

  it("rejects request missing X-SMSHub-Signature header with 400", async () => {
    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .send({ event: "ping" })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("MISSING_SIGNATURE");
  });

  it("rejects expired webhook signatures (> 300 seconds) with 400", async () => {
    const bodyStr = JSON.stringify({ event: "ping" });
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 350; // 350 seconds ago
    const signature = generateSignature(bodyStr, expiredTimestamp);

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", signature)
      .send(bodyStr)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("EXPIRED_SIGNATURE");
  });

  it("rejects forged or tampered webhook signatures with 400", async () => {
    const bodyStr = JSON.stringify({ event: "ping" });
    const now = Math.floor(Date.now() / 1000);
    const forgedSignature = `t=${now},v1=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad1`;

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", forgedSignature)
      .send(bodyStr)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("handles duplicate delivery IDs idempotently with 200 acknowledgment", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue({
      id: "existing-event",
      delivery_id: "deliv-uuid-dup",
    });

    const bodyStr = JSON.stringify({ event: "message.sent" });
    const now = Math.floor(Date.now() / 1000);
    const signature = generateSignature(bodyStr, now);

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", signature)
      .set("X-SMSHub-Event", "message.sent")
      .set("X-SMSHub-Delivery", "deliv-uuid-dup")
      .send(bodyStr)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toBe(true);
    expect(res.body.data.duplicate).toBe(true);
    expect(prismaMock.message.update).not.toHaveBeenCalled();
  });
});
