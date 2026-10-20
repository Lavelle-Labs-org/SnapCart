import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { SMSHubService } from "../src/modules/smshub/smshub.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { SESSION_COOKIE_NAME } from "../src/modules/auth/auth.types";

describe("NestJS Messages API E2E (BE-016)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;
  let authService: AuthService;
  let seller1Token: string;
  let seller2Token: string;

  const seller1 = {
    id: "seller-111",
    business_name: "Habesha Cafe & Bakery",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    phone_verified_at: new Date(),
    slug: "habesha-cafe",
  };

  const seller2 = {
    id: "seller-222",
    business_name: "Intruder Shop",
    sms_name: "Intruder",
    phone: "0922334455",
    phone_verified_at: new Date(),
    slug: "intruder-shop",
  };

  let messagesDb: Map<string, any>;

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_messages_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    messagesDb = new Map();

    const failedMsg = {
      id: "msg-failed-1",
      seller_id: seller1.id,
      order_id: null,
      recipient_phone: "0911223344",
      event: "seller_new_order",
      text: "Order #1001 incoming",
      status: "failed",
      skip_reason: null,
      smshub_message_id: null,
      request_id: "req-err-1",
      network: null,
      credits_used: 0,
      error_type: "network_error",
      attempts: 1,
      created_at: new Date("2026-10-20T10:00:00Z"),
      updated_at: new Date("2026-10-20T10:00:00Z"),
    };

    const sentMsg = {
      id: "msg-sent-1",
      seller_id: seller1.id,
      order_id: null,
      recipient_phone: "0911223344",
      event: "seller_new_order",
      text: "Order #1002 incoming",
      status: "sent",
      skip_reason: null,
      smshub_message_id: "smshub-existing",
      request_id: "req-ok-1",
      network: "ethio_telecom",
      credits_used: 1,
      error_type: null,
      attempts: 1,
      created_at: new Date("2026-10-20T09:00:00Z"),
      updated_at: new Date("2026-10-20T09:00:00Z"),
    };

    const seller2Msg = {
      id: "msg-seller2-1",
      seller_id: seller2.id,
      order_id: null,
      recipient_phone: "0922334455",
      event: "seller_new_order",
      text: "Order #2001 incoming",
      status: "failed",
      skip_reason: null,
      smshub_message_id: null,
      request_id: null,
      network: null,
      credits_used: 0,
      error_type: "timeout",
      attempts: 1,
      created_at: new Date("2026-10-20T08:00:00Z"),
      updated_at: new Date("2026-10-20T08:00:00Z"),
    };

    messagesDb.set(failedMsg.id, failedMsg);
    messagesDb.set(sentMsg.id, sentMsg);
    messagesDb.set(seller2Msg.id, seller2Msg);

    prismaMock = {
      seller: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === seller1.id) return Promise.resolve(seller1);
          if (where.id === seller2.id) return Promise.resolve(seller2);
          return Promise.resolve(null);
        }),
      },
      message: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          const sellerId = where?.OR?.[0]?.seller_id;
          const matched = Array.from(messagesDb.values()).filter(
            (m) => m.seller_id === sellerId
          );
          return Promise.resolve(matched);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve(messagesDb.get(where.id) || null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const existing = messagesDb.get(where.id);
          if (!existing) return Promise.resolve(null);
          const updated = { ...existing, ...data, updated_at: new Date() };
          messagesDb.set(where.id, updated);
          return Promise.resolve(updated);
        }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      suppressionList: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    smshubMock = {
      sendSMS: vi.fn().mockResolvedValue({
        status: "success",
        data: {
          message_id: "smshub-resend-uuid-1",
          network: "ethio_telecom",
          credits_used: 1,
          request_id: "req-resend-1",
        },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SMSHubService)
      .useValue(smshubMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    authService = app.get(AuthService);
    seller1Token = await authService.createSessionToken({ sellerId: seller1.id });
    seller2Token = await authService.createSessionToken({ sellerId: seller2.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/messages", () => {
    it("returns 401 Unauthorized without session cookie", async () => {
      await request(app.getHttpServer())
        .get("/api/messages")
        .expect(401);
    });

    it("returns 200 with messages for seller1", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/messages")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data.some((m: any) => m.id === "msg-failed-1")).toBe(true);
      expect(res.body.data.some((m: any) => m.id === "msg-sent-1")).toBe(true);
    });
  });

  describe("POST /api/messages/:id/resend", () => {
    it("returns 401 Unauthorized without session cookie", async () => {
      await request(app.getHttpServer())
        .post("/api/messages/msg-failed-1/resend")
        .expect(401);
    });

    it("returns 404 Not Found for non-existent message", async () => {
      await request(app.getHttpServer())
        .post("/api/messages/non-existent-msg/resend")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(404);
    });

    it("returns 403 Forbidden when attempting to resend another seller's message", async () => {
      await request(app.getHttpServer())
        .post("/api/messages/msg-seller2-1/resend")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(403);
    });

    it("returns 400 Bad Request with INVALID_MESSAGE_STATUS when resending a sent message", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/messages/msg-sent-1/resend")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_MESSAGE_STATUS");
    });

    it("successfully resends failed message and updates attempts and status to sent", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/messages/msg-failed-1/resend")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.resent).toBe(true);
      expect(res.body.data.message.status).toBe("sent");
      expect(res.body.data.message.attempts).toBe(2);
      expect(res.body.data.message.smshubMessageId).toBe("smshub-resend-uuid-1");

      expect(smshubMock.sendSMS).toHaveBeenCalledWith({
        msisdn: "0911223344",
        text: "Order #1001 incoming",
        trackLinks: false,
      });

      // Verify in-memory state was updated
      const updated = messagesDb.get("msg-failed-1");
      expect(updated.status).toBe("sent");
      expect(updated.attempts).toBe(2);
      expect(updated.smshub_message_id).toBe("smshub-resend-uuid-1");
    });
  });
});
