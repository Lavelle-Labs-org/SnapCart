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
import crypto from "crypto";

describe("NestJS Seller Action Link Execution APIs E2E (BE-011)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;

  const validToken = "K9x2m1ZbQrT4uV8wY0aBcD";
  const validTokenHash = crypto
    .createHash("sha256")
    .update(validToken)
    .digest("hex");

  const demoSeller = {
    id: "seller-action-1",
    business_name: "Habesha Roastery",
    sms_name: "Habesha",
    phone: "0911223344",
    phone_verified_at: new Date(),
    slug: "habesha-roastery",
  };

  const demoOrder = {
    id: "order-e2e-action-1",
    seller_id: demoSeller.id,
    number: 1043,
    buyer_name: "Tadesse Gemechu",
    buyer_phone: "0911556677",
    sms_consent: true,
    consent_wording: "I agree to receive SMS updates",
    consent_at: new Date(),
    state: "new",
    total_santim: 85000,
    created_at: new Date(),
    seller: demoSeller,
    order_items: [
      {
        id: "item-1",
        order_id: "order-e2e-action-1",
        product_id: "prod-1",
        name_at_order: "Special Coffee Blend",
        unit_price_santim: 85000,
        quantity: 1,
      },
    ],
  };

  const activeTokenRecord = {
    id: "token-record-1",
    order_id: demoOrder.id,
    purpose: "seller_action",
    token_hash: validTokenHash,
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h validity
    revoked_at: null,
    order: demoOrder,
  };

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_action_links_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      actionToken: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.token_hash === validTokenHash) {
            return Promise.resolve(activeTokenRecord);
          }
          return Promise.resolve(null);
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === demoOrder.id) {
            return Promise.resolve(demoOrder);
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          return Promise.resolve({
            ...demoOrder,
            state: data.state,
          });
        }),
      },
      orderEvent: {
        create: vi.fn().mockResolvedValue({ id: "event-action-1" }),
      },
      pickupCode: {
        upsert: vi.fn().mockResolvedValue({ id: "pickup-1" }),
      },
      suppressionList: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      message: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "msg-action-1",
            ...data,
            attempts: 1,
            created_at: new Date(),
            updated_at: new Date(),
          })
        ),
      },
      $transaction: vi.fn().mockImplementation((callback) => callback(prismaMock)),
    };

    smshubMock = {
      sendSMS: vi.fn().mockResolvedValue({
        success: true,
        data: {
          message_id: "msg_action_link_test",
          credits_used: 1,
          would_send: true,
        },
      }),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SMSHubService)
      .useValue(smshubMock)
      .compile();

    app = moduleRef.createNestApplication();
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

  describe("Token Verification & Error Cases", () => {
    it("returns 404 for unknown or malformed token", async () => {
      const res = await request(app.getHttpServer()).get("/api/a/non_existent_token");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("GET /api/a/:token", () => {
    it("returns order preview details for valid token", async () => {
      const res = await request(app.getHttpServer()).get(`/api/a/${validToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBe(1043);
      expect(res.body.data.state).toBe("new");
      expect(res.body.data.buyerName).toBe("Tadesse Gemechu");
    });
  });

  describe("POST /api/a/:token/accept", () => {
    it("transitions order to accepted and triggers buyer notification", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/a/${validToken}/accept`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentState).toBe("accepted");
      expect(res.body.data.orderNumber).toBe(1043);
      expect(prismaMock.order.update).toHaveBeenCalled();
    });
  });

  describe("POST /api/a/:token/reject", () => {
    it("transitions order to rejected and revokes action tokens", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/a/${validToken}/reject`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentState).toBe("rejected");
    });
  });

  describe("POST /api/a/:token/ready", () => {
    it("transitions order to ready and generates pickup code", async () => {
      // Mock order in accepted state
      prismaMock.order.findUnique.mockResolvedValueOnce({
        ...demoOrder,
        state: "accepted",
      });

      const res = await request(app.getHttpServer())
        .post(`/api/a/${validToken}/ready`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.currentState).toBe("ready");
      expect(res.body.data.pickupCode).toBeDefined();
    });
  });
});
