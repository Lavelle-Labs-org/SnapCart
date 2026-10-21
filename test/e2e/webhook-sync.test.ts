import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import crypto from "crypto";

import { AppModule } from "../../apps/api/src/app.module";
import { TransformInterceptor } from "../../apps/api/src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../../apps/api/src/common/filters/http-exception.filter";
import { PrismaService } from "../../apps/api/src/prisma/prisma.service";
import { MockSMSHubServer } from "../mocks/smshub-server";

describe("Scenario E10: Inbound Webhook Signature & Status Sync Integration Tests (QA-006, #43)", () => {
  let app: INestApplication;
  let mockSMSHub: MockSMSHubServer;
  let mockServerUrl: string;

  const WEBHOOK_SECRET = "sk_webhook_secret_qa006_test_32_chars";

  // In-memory database tables
  let dbMessages: Map<string, any>;
  let dbMessageEvents: Map<string, any>;
  let dbOrders: Map<string, any>;
  let dbSellers: Map<string, any>;

  let prismaMock: any;

  beforeAll(async () => {
    mockSMSHub = new MockSMSHubServer({
      initialBalance: 100,
      defaultOtp: "112233",
    });
    mockServerUrl = await mockSMSHub.start();

    process.env.SMSHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SMSHUB_API_KEY = "sk_test_qa006_key_zero_credit";
    process.env.SMSHUB_MODE = "test";
    process.env.SMSHUB_BASE_URL = mockServerUrl;
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";
    delete process.env.SMS_SENDING_PAUSED;
    delete process.env.SMS_ALLOWLIST;

    dbMessages = new Map();
    dbMessageEvents = new Map();
    dbOrders = new Map();
    dbSellers = new Map();

    prismaMock = {
      $connect: async () => {},
      $disconnect: async () => {},
      seller: {
        findUnique: async ({ where }: any) => {
          return dbSellers.get(where.id || where.slug) || null;
        },
      },
      order: {
        findUnique: async ({ where }: any) => {
          return dbOrders.get(where.id) || null;
        },
      },
      message: {
        create: async ({ data }: any) => {
          const id = data.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const record = {
            id,
            created_at: new Date(),
            updated_at: new Date(),
            ...data,
          };
          dbMessages.set(id, record);
          if (data.smshub_message_id) {
            dbMessages.set(data.smshub_message_id, record);
          }
          return { ...record };
        },
        findUnique: async ({ where }: any) => {
          if (where.id) {
            const m = dbMessages.get(where.id);
            return m ? { ...m } : null;
          }
          if (where.smshub_message_id) {
            const m = dbMessages.get(where.smshub_message_id);
            return m ? { ...m } : null;
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          let record = null;
          if (where.id) record = dbMessages.get(where.id);
          else if (where.smshub_message_id) record = dbMessages.get(where.smshub_message_id);

          if (!record) throw new Error("Message not found");
          const updated = { ...record, ...data, updated_at: new Date() };
          dbMessages.set(record.id, updated);
          if (record.smshub_message_id) {
            dbMessages.set(record.smshub_message_id, updated);
          }
          return { ...updated };
        },
        findMany: async ({ where }: any) => {
          return Array.from(dbMessages.values()).filter((m) => {
            if (where?.order_id && m.order_id !== where.order_id) return false;
            return true;
          });
        },
      },
      messageEvent: {
        findUnique: async ({ where }: any) => {
          if (where.delivery_id) {
            const ev = dbMessageEvents.get(where.delivery_id);
            return ev ? { ...ev } : null;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = `mev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const ev = {
            id,
            created_at: new Date(),
            ...data,
          };
          if (data.delivery_id) {
            if (dbMessageEvents.has(data.delivery_id)) {
              const err: any = new Error("Unique constraint failed");
              err.code = "P2002";
              throw err;
            }
            dbMessageEvents.set(data.delivery_id, ev);
          }
          return { ...ev };
        },
        findMany: async ({ where }: any) => {
          return Array.from(dbMessageEvents.values()).filter((e) => {
            if (where?.delivery_id && e.delivery_id !== where.delivery_id) return false;
            if (where?.message_id && e.message_id !== where.message_id) return false;
            return true;
          });
        },
      },
      $transaction: async (arg: any) => {
        if (typeof arg === "function") {
          return arg(prismaMock);
        }
        return Promise.all(arg);
      },
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mockSMSHub) {
      await mockSMSHub.stop();
    }
  });

  beforeEach(() => {
    dbMessages = new Map();
    dbMessageEvents = new Map();
    dbOrders = new Map();
    dbSellers = new Map();
    mockSMSHub.reset();
  });

  // Helper to generate compliant HMAC-SHA256 signature header: t={timestamp},v1={hex_hmac}
  function signWebhook(
    body: string,
    secret: string = WEBHOOK_SECRET,
    timestamp: number = Math.floor(Date.now() / 1000)
  ): string {
    const dataToSign = `${timestamp}.${body}`;
    const hmac = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");
    return `t=${timestamp},v1=${hmac}`;
  }

  // =========================================================================
  // Test 1: Signature Verification & Rejection of Forged/Invalid Signatures
  // =========================================================================
  describe("HMAC Signature Integrity & Rejection of Forged Requests", () => {
    const validBody = JSON.stringify({
      event: "message.sent",
      delivery_id: "deliv-sig-1",
      data: { message_id: "smshub_msg_001", status: "sent" },
    });

    it("rejects request missing X-SMSHub-Signature header with 400 MISSING_SIGNATURE", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", "deliv-missing-sig")
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("MISSING_SIGNATURE");
    });

    it("rejects request with forged / invalid HMAC signature with 400 INVALID_SIGNATURE", async () => {
      const invalidSignature = signWebhook(validBody, "wrong_attacker_secret_key");

      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", invalidSignature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", "deliv-forged-sig")
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_SIGNATURE");
    });

    it("rejects request when body payload is tampered after signing", async () => {
      // Signature computed for validBody
      const validSignature = signWebhook(validBody, WEBHOOK_SECRET);

      // Tampered body sent with validBody's signature
      const tamperedBody = JSON.stringify({
        event: "message.sent",
        delivery_id: "deliv-sig-1",
        data: { message_id: "smshub_msg_tampered", status: "failed" },
      });

      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", validSignature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", "deliv-sig-1")
        .send(tamperedBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_SIGNATURE");
    });

    it("rejects expired webhook signatures older than 300 seconds (replay attack prevention)", async () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 305; // 305s ago (> 300s threshold)
      const expiredSignature = signWebhook(validBody, WEBHOOK_SECRET, pastTimestamp);

      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", expiredSignature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", "deliv-replay-attack")
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("EXPIRED_SIGNATURE");
    });

    it("rejects malformed signature headers missing t= or v1=", async () => {
      const malformedSignatures = [
        "random_hex_string_without_timestamp",
        "t=1700000000",
        "v1=abc12345",
        "timestamp=1700000000,signature=abc",
      ];

      for (const malformed of malformedSignatures) {
        const res = await request(app.getHttpServer())
          .post("/api/webhooks/smshub")
          .set("Content-Type", "application/json")
          .set("X-SMSHub-Signature", malformed)
          .set("X-SMSHub-Event", "message.sent")
          .set("X-SMSHub-Delivery", "deliv-malformed")
          .send(validBody);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("MALFORMED_SIGNATURE");
      }
    });
  });

  // =========================================================================
  // Test 2: Valid message.sent Updates Status to 'sent'
  // =========================================================================
  describe("Valid Delivery Updates Message Status to 'sent'", () => {
    it("updates message record status to 'sent' and logs message_event audit record", async () => {
      const smshubMessageId = "smshub_live_msg_7788";
      const deliveryId = "deliv_sent_uuid_001";

      // Seed pending message in database
      const seedMessage = {
        id: "msg-test-1",
        order_id: "order-test-1",
        seller_id: "seller-test-1",
        phone: "0911223344",
        event: "buyer_order_accepted",
        text: "Habesha Cafe: order #1001 accepted.",
        status: "pending",
        direction: "outbound",
        smshub_message_id: smshubMessageId,
      };
      dbMessages.set(seedMessage.id, seedMessage);
      dbMessages.set(smshubMessageId, seedMessage);

      const payload = {
        event: "message.sent",
        delivery_id: deliveryId,
        data: {
          message_id: smshubMessageId,
          status: "sent",
          carrier: "Ethio Telecom",
          sent_at: new Date().toISOString(),
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = signWebhook(rawBody, WEBHOOK_SECRET);

      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", signature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", deliveryId)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.received).toBe(true);
      expect(res.body.data.event).toBe("message.sent");
      expect(res.body.data.deliveryId).toBe(deliveryId);

      // Verify message status in DB was updated to 'sent'
      const updatedMsg = dbMessages.get(seedMessage.id);
      expect(updatedMsg.status).toBe("sent");

      // Verify audit event persisted in message_events
      const eventRecord = dbMessageEvents.get(deliveryId);
      expect(eventRecord).toBeDefined();
      expect(eventRecord.delivery_id).toBe(deliveryId);
      expect(eventRecord.message_id).toBe(seedMessage.id);
      expect(eventRecord.event_type).toBe("message.sent");
    });

    it("updates message record to 'failed' with error_type when receiving message.failed event", async () => {
      const smshubMessageId = "smshub_fail_msg_9900";
      const deliveryId = "deliv_failed_uuid_002";

      const seedMessage = {
        id: "msg-test-failed",
        order_id: "order-test-2",
        seller_id: "seller-test-1",
        phone: "0922334455",
        event: "buyer_order_ready",
        text: "Habesha Cafe: order #1002 is ready. Pickup code: 4821.",
        status: "pending",
        direction: "outbound",
        smshub_message_id: smshubMessageId,
      };
      dbMessages.set(seedMessage.id, seedMessage);
      dbMessages.set(smshubMessageId, seedMessage);

      const payload = {
        event: "message.failed",
        delivery_id: deliveryId,
        data: {
          message_id: smshubMessageId,
          error_type: "carrier_timeout",
          error: "Recipient unreachable",
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = signWebhook(rawBody, WEBHOOK_SECRET);

      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", signature)
        .set("X-SMSHub-Event", "message.failed")
        .set("X-SMSHub-Delivery", deliveryId)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.data.received).toBe(true);

      // Invariant: Status updated to 'failed' and error_type recorded
      const updatedMsg = dbMessages.get(seedMessage.id);
      expect(updatedMsg.status).toBe("failed");
      expect(updatedMsg.error_type).toBe("carrier_timeout");
    });
  });

  // =========================================================================
  // Test 3: Duplicate Delivery ID Changes Nothing (Idempotency)
  // =========================================================================
  describe("Delivery Idempotency & Duplicate Replay Protection", () => {
    it("safely ignores duplicate delivery IDs without updating message or creating duplicate events", async () => {
      const smshubMessageId = "smshub_idem_msg_3344";
      const deliveryId = "deliv_idem_uuid_777";

      const seedMessage = {
        id: "msg-idem-1",
        order_id: "order-idem-1",
        seller_id: "seller-test-1",
        phone: "0911002233",
        event: "buyer_order_accepted",
        status: "pending",
        direction: "outbound",
        smshub_message_id: smshubMessageId,
      };
      dbMessages.set(seedMessage.id, seedMessage);
      dbMessages.set(smshubMessageId, seedMessage);

      const payload = {
        event: "message.sent",
        delivery_id: deliveryId,
        data: { message_id: smshubMessageId, status: "sent" },
      };
      const rawBody = JSON.stringify(payload);
      const signature = signWebhook(rawBody, WEBHOOK_SECRET);

      // 1. First webhook delivery
      const firstRes = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", signature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", deliveryId)
        .send(rawBody);

      expect(firstRes.status).toBe(200);
      expect(firstRes.body.data.duplicate).toBeUndefined();
      expect(dbMessages.get(seedMessage.id).status).toBe("sent");

      const eventCountAfterFirst = dbMessageEvents.size;
      expect(eventCountAfterFirst).toBe(1);

      // 2. Second webhook delivery with IDENTICAL deliveryId (replay)
      const secondRes = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", signature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", deliveryId)
        .send(rawBody);

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.data.received).toBe(true);
      expect(secondRes.body.data.duplicate).toBe(true);

      // Invariant: Zero duplicate events created
      expect(dbMessageEvents.size).toBe(eventCountAfterFirst);

      // Invariant: Message status remains unchanged
      expect(dbMessages.get(seedMessage.id).status).toBe("sent");
    });
  });

  // =========================================================================
  // Test 4: Sensitive Data Stripping / Redaction (Security Invariant)
  // =========================================================================
  describe("Security Invariant: Plaintext OTP and Pickup Code Stripping", () => {
    it("redacts sensitive pickup codes, OTPs, and tokens before persisting in message_events raw_payload", async () => {
      const deliveryId = "deliv_sanitize_uuid_999";
      const payload = {
        event: "message.sent",
        delivery_id: deliveryId,
        code: "4821",
        otp: "654321",
        token: "sat_super_secret_token_123",
        text: "Order #1005 is ready. Pickup code: 4821. Your OTP code is 654321.",
        data: {
          pickup_code: "4821",
          secret: "sensitive_seller_key",
          message: "Show code: 4821 when you pick up",
        },
      };
      const rawBody = JSON.stringify(payload);
      const signature = signWebhook(rawBody, WEBHOOK_SECRET);

      const res = await request(app.getHttpServer())
        .post("/api/webhooks/smshub")
        .set("Content-Type", "application/json")
        .set("X-SMSHub-Signature", signature)
        .set("X-SMSHub-Event", "message.sent")
        .set("X-SMSHub-Delivery", deliveryId)
        .send(rawBody);

      expect(res.status).toBe(200);

      const eventRecord = dbMessageEvents.get(deliveryId);
      expect(eventRecord).toBeDefined();

      const savedRaw = eventRecord.raw_payload;
      // Invariant: Sensitive plaintext codes and tokens must NEVER appear in raw_payload
      expect(savedRaw).not.toContain("4821");
      expect(savedRaw).not.toContain("654321");
      expect(savedRaw).not.toContain("sat_super_secret_token_123");
      expect(savedRaw).not.toContain("sensitive_seller_key");
      expect(savedRaw).toContain("[REDACTED]");
    });
  });
});
