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
import { SMSHubService } from "../src/modules/smshub/smshub.service";
import { OrdersService } from "../src/modules/orders/orders.service";

describe("NestJS Buyer SMS Opt-Out & Suppression API E2E (BE-015)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;

  const validStopToken = "valid_buyer_stop_token_22char";
  const validStopTokenHash = crypto
    .createHash("sha256")
    .update(validStopToken)
    .digest("hex");

  const expiredStopToken = "expired_stop_token_22char";
  const expiredStopTokenHash = crypto
    .createHash("sha256")
    .update(expiredStopToken)
    .digest("hex");

  const sellerActionToken = "seller_action_token_22char";
  const sellerActionTokenHash = crypto
    .createHash("sha256")
    .update(sellerActionToken)
    .digest("hex");

  const demoSeller = {
    id: "seller-123",
    business_name: "Habesha Roastery",
    sms_name: "Habesha",
    phone: "0911223344",
    phone_verified_at: new Date(),
    slug: "habesha-roastery",
  };

  const demoOrder = {
    id: "order-stop-e2e-1",
    seller_id: demoSeller.id,
    number: 1043,
    buyer_name: "Almaz Kebede",
    buyer_phone: "0911556677",
    sms_consent: true,
    consent_wording: "I agree to receive SMS updates",
    consent_at: new Date(),
    state: "accepted",
    total_santim: 45000,
    created_at: new Date(),
    seller: demoSeller,
    order_items: [
      {
        id: "item-1",
        order_id: "order-stop-e2e-1",
        product_id: "prod-1",
        name_at_order: "Special Coffee Blend",
        unit_price_santim: 45000,
        quantity: 1,
      },
    ],
  };

  const activeStopTokenRecord = {
    id: "stop-token-uuid-1",
    order_id: demoOrder.id,
    purpose: "buyer_stop",
    token_hash: validStopTokenHash,
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h validity
    revoked_at: null as Date | null,
    order: demoOrder,
  };

  const dbSuppression = new Map<string, any>();

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_stop_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      actionToken: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.token_hash === validStopTokenHash) {
            return Promise.resolve({ ...activeStopTokenRecord });
          }
          if (where.token_hash === expiredStopTokenHash) {
            return Promise.resolve({
              ...activeStopTokenRecord,
              id: "expired-token-id",
              token_hash: expiredStopTokenHash,
              expires_at: new Date(Date.now() - 60000), // expired 1m ago
            });
          }
          if (where.token_hash === sellerActionTokenHash) {
            return Promise.resolve({
              ...activeStopTokenRecord,
              id: "seller-action-token-id",
              token_hash: sellerActionTokenHash,
              purpose: "seller_action",
            });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          if (where.id === activeStopTokenRecord.id) {
            activeStopTokenRecord.revoked_at = data.revoked_at;
          }
          return Promise.resolve(activeStopTokenRecord);
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: "tok-new" }),
      },
      suppressionList: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve(dbSuppression.get(where.phone) ?? null);
        }),
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const record = {
            id: "sup-uuid-1",
            phone: where.phone,
            reason: create.reason || update.reason || "buyer_stop",
            order_id: create.order_id || update.order_id,
            created_at: new Date(),
          };
          dbSuppression.set(where.phone, record);
          return Promise.resolve(record);
        }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(demoOrder),
        update: vi.fn().mockResolvedValue(demoOrder),
      },
      orderEvent: {
        create: vi.fn().mockResolvedValue({ id: "event-1" }),
      },
      pickupCode: {
        upsert: vi.fn().mockResolvedValue({ id: "pickup-1" }),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      message: {
        create: vi.fn().mockImplementation(({ data }) => {
          return Promise.resolve({
            id: "msg-" + Math.random().toString(36).substring(7),
            ...data,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }),
      },
      $transaction: vi.fn().mockImplementation((callback) => callback(prismaMock)),
    };

    smshubMock = {
      sendSMS: vi.fn().mockResolvedValue({
        message_id: "smshub_msg_stop_test",
        status: "sent",
        request_id: "req_stop_1",
      }),
      testSMS: vi.fn().mockResolvedValue({
        message_id: "test_msg_1",
        status: "sent",
        test_mode: true,
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

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix("api");
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
    activeStopTokenRecord.revoked_at = null;
    dbSuppression.clear();
  });

  describe("GET /api/stop/:token (Read-Only Preview)", () => {
    it("returns 200 with order and masked phone details without modifying database", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stop/${validStopToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.orderNumber).toBe(1043);
      expect(res.body.data.shopName).toBe("Habesha");
      expect(res.body.data.maskedPhone).toBe("09•• ••• 677");
      expect(res.body.data.alreadySuppressed).toBe(false);

      expect(prismaMock.suppressionList.upsert).not.toHaveBeenCalled();
      expect(prismaMock.actionToken.update).not.toHaveBeenCalled();
    });

    it("returns 404 for forged or unknown stop token", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/stop/unknown_forged_stop_token")
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it("returns 404 for expired stop token", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stop/${expiredStopToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it("returns 404 when token purpose is not buyer_stop", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/stop/${sellerActionToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /api/stop/:token (Opt-Out Execution)", () => {
    it("successfully suppresses buyer phone and revokes action token", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stop/${validStopToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.suppressed).toBe(true);
      expect(res.body.data.phone).toBe("09•• ••• 677");

      // Verify suppression_list in DB
      expect(dbSuppression.has("0911556677")).toBe(true);
      expect(dbSuppression.get("0911556677")).toEqual(
        expect.objectContaining({
          phone: "0911556677",
          reason: "buyer_stop",
          order_id: demoOrder.id,
        })
      );

      // Verify action_tokens revoked_at was set
      expect(activeStopTokenRecord.revoked_at).not.toBeNull();
    });

    it("handles idempotent re-opt-out when phone is already suppressed", async () => {
      // First opt-out
      await request(app.getHttpServer())
        .post(`/api/stop/${validStopToken}`)
        .expect(200);

      expect(dbSuppression.has("0911556677")).toBe(true);

      // Second opt-out attempt with same token (already revoked)
      const res = await request(app.getHttpServer())
        .post(`/api/stop/${validStopToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.suppressed).toBe(true);
      expect(res.body.data.alreadySuppressed).toBe(true);
      expect(res.body.data.phone).toBe("09•• ••• 677");
    });

    it("returns 404 for unknown or forged token", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/stop/bad_token_123")
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it("returns 404 for expired stop token", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stop/${expiredStopToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it("returns 404 when token purpose is not buyer_stop", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/stop/${sellerActionToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe("Subsequent SMS Suppression Enforcement (Scenario E4)", () => {
    it("skips subsequent buyer notification when phone is present in suppression_list", async () => {
      // 1. Buyer opts out
      await request(app.getHttpServer())
        .post(`/api/stop/${validStopToken}`)
        .expect(200);

      expect(dbSuppression.has("0911556677")).toBe(true);

      // 2. Clear SMSHub call records
      smshubMock.sendSMS.mockClear();

      // 3. Seller marks order ready: transitionOrderState('ready')
      const ordersService = app.get(OrdersService);
      const readyResult = await ordersService.transitionOrderState(
        demoOrder.id,
        "ready",
        "seller_link"
      );

      expect(readyResult.success).toBe(true);
      expect(readyResult.currentState).toBe("ready");

      // 4. Verify SMS was skipped, 0 outbound SMS was dispatched, and message logged as skipped
      expect(smshubMock.sendSMS).not.toHaveBeenCalled();
      expect(readyResult.smsResult?.status).toBe("skipped");
      expect(readyResult.smsResult?.skipReason).toBe("opted_out");
      expect(prismaMock.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipient_phone: "0911556677",
            status: "skipped",
            skip_reason: "opted_out",
          }),
        })
      );
    });
  });
});
