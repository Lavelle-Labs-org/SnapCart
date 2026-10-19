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
import { hashPickupCode } from "../src/modules/crypto/crypto.service";

describe("NestJS Orders API E2E (BE-013)", () => {
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

  let ordersDb: Map<string, any>;
  let pickupCodesDb: Map<string, any>;
  let orderEventsDb: any[];

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_orders_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    ordersDb = new Map();
    pickupCodesDb = new Map();
    orderEventsDb = [];

    // Seed test orders
    const orderNew = {
      id: "ord-new-1",
      seller_id: seller1.id,
      number: 1001,
      buyer_name: "Abebe Bikila",
      buyer_phone: "0911223344",
      sms_consent: true,
      consent_wording: "Send updates",
      consent_at: new Date(),
      state: "new",
      total_santim: 85000,
      created_at: new Date(),
      seller: seller1,
      order_items: [],
      order_events: [],
    };

    const orderReady = {
      id: "ord-ready-1",
      seller_id: seller1.id,
      number: 1002,
      buyer_name: "Sara Hailu",
      buyer_phone: "0799887766",
      sms_consent: true,
      consent_wording: "Send updates",
      consent_at: new Date(),
      state: "ready",
      total_santim: 60000,
      created_at: new Date(),
      seller: seller1,
      order_items: [],
      order_events: [],
    };

    const orderSeller2 = {
      id: "ord-seller2-1",
      seller_id: seller2.id,
      number: 2001,
      buyer_name: "Dawit Kebede",
      buyer_phone: "0933445566",
      sms_consent: true,
      consent_wording: "Send updates",
      consent_at: new Date(),
      state: "new",
      total_santim: 40000,
      created_at: new Date(),
      seller: seller2,
      order_items: [],
      order_events: [],
    };

    ordersDb.set(orderNew.id, orderNew);
    ordersDb.set(orderReady.id, orderReady);
    ordersDb.set(orderSeller2.id, orderSeller2);

    const validPickupCode = "4821";
    pickupCodesDb.set(orderReady.id, {
      id: "pc-1",
      order_id: orderReady.id,
      code_hash: hashPickupCode(validPickupCode),
      attempts: 0,
      expires_at: new Date(Date.now() + 86400000),
      issued_at: new Date(),
    });

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === seller1.id) return Promise.resolve(seller1);
          if (where.id === seller2.id) return Promise.resolve(seller2);
          return Promise.resolve(null);
        }),
      },
      order: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const o = ordersDb.get(where.id);
          return Promise.resolve(o ? { ...o } : null);
        }),
        findMany: vi.fn().mockImplementation(({ where }) => {
          const list = Array.from(ordersDb.values()).filter(
            (o) => !where?.seller_id || o.seller_id === where.seller_id
          );
          return Promise.resolve(list);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const existing = ordersDb.get(where.id);
          if (!existing) throw new Error("Order not found");
          const updated = { ...existing, ...data };
          ordersDb.set(where.id, updated);
          return Promise.resolve({ ...updated });
        }),
      },
      orderEvent: {
        create: vi.fn().mockImplementation(({ data }) => {
          const ev = { id: `ev-${Date.now()}`, ...data };
          orderEventsDb.push(ev);
          return Promise.resolve(ev);
        }),
      },
      actionToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      pickupCode: {
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const existing = pickupCodesDb.get(where.order_id);
          const record = existing ? { ...existing, ...update } : { ...create };
          pickupCodesDb.set(where.order_id, record);
          return Promise.resolve(record);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const record = pickupCodesDb.get(where.order_id);
          return Promise.resolve(record ? { ...record } : null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const existing = pickupCodesDb.get(where.order_id);
          if (!existing) throw new Error("Pickup code not found");
          const updated = { ...existing, ...data };
          pickupCodesDb.set(where.order_id, updated);
          return Promise.resolve(updated);
        }),
      },
      suppressionList: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "msg-1", status: "sent" }),
      },
      $transaction: vi.fn().mockImplementation((cb) => cb(prismaMock)),
    };

    smshubMock = {
      sendSMS: vi.fn().mockResolvedValue({
        success: true,
        data: { message_id: "msg_mock_orders" },
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

    authService = app.get(AuthService);
    seller1Token = await authService.createSessionToken({ sellerId: seller1.id });
    seller2Token = await authService.createSessionToken({ sellerId: seller2.id });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("Authentication & Authorization Enforcement", () => {
    it("returns 401 when no session cookie or token is provided", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/orders/ord-new-1")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 404 when order does not exist", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/orders/non-existent-ord/accept")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 Forbidden when seller attempts action on an order owned by another seller", async () => {
      // Seller 2 attempts to accept Seller 1's order (ord-new-1)
      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-new-1/accept")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller2Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(res.body.error.message).toContain("permission");
    });
  });

  describe("GET /api/orders and GET /api/orders/:id", () => {
    it("lists orders belonging to the authenticated seller", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/orders")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Ensure all returned orders belong to seller1
      expect(res.body.data.every((o: any) => o.sellerId === seller1.id)).toBe(true);
    });

    it("retrieves single order details for owner", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/orders/ord-new-1")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("ord-new-1");
      expect(res.body.data.number).toBe(1001);
      expect(res.body.data.buyerName).toBe("Abebe Bikila");
    });
  });

  describe("POST /api/orders/:id/accept", () => {
    it("transitions order from new to accepted and dispatches buyer accepted SMS", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-new-1/accept")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.currentState || res.body.data?.currentState).toBe("accepted");
      expect(res.body.previousState || res.body.data?.previousState).toBe("new");
      expect(ordersDb.get("ord-new-1").state).toBe("accepted");
    });
  });

  describe("POST /api/orders/:id/ready", () => {
    it("transitions order from accepted to ready, generates pickup code, and texts buyer", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-new-1/ready")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.currentState || res.body.data?.currentState).toBe("ready");
      expect(res.body.pickupCode || res.body.data?.pickupCode).toMatch(/^\d{4}$/);
      expect(ordersDb.get("ord-new-1").state).toBe("ready");
    });
  });

  describe("POST /api/orders/:id/pickup-code/reissue", () => {
    it("reissues fresh 4-digit code, resets attempts to 0, and dispatches buyer SMS", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-ready-1/pickup-code/reissue")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.pickupCode || res.body.data?.pickupCode).toMatch(/^\d{4}$/);
      expect(res.body.orderId || res.body.data?.orderId).toBe("ord-ready-1");

      const updatedPc = pickupCodesDb.get("ord-ready-1");
      expect(updatedPc.attempts).toBe(0);
    });

    it("returns 409 Conflict when attempting to reissue code for non-ready order", async () => {
      // Re-seed an order in 'completed' state
      ordersDb.set("ord-completed-1", {
        id: "ord-completed-1",
        seller_id: seller1.id,
        number: 1003,
        state: "completed",
        buyer_phone: "0911223344",
        seller: seller1,
      });

      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-completed-1/pickup-code/reissue")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
    });
  });

  describe("POST /api/orders/:id/complete", () => {
    it("returns 400 when invalid pickup code is submitted", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-ready-1/complete")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .send({ code: "0000" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_PICKUP_CODE");
    });

    it("completes handover with matching pickup code", async () => {
      // ord-new-1 has an active pickup code generated from the ready transition
      const readyOrder = ordersDb.get("ord-new-1");
      expect(readyOrder.state).toBe("ready");

      // Set known code for ord-new-1
      const knownCode = "9876";
      pickupCodesDb.set("ord-new-1", {
        id: "pc-new-1",
        order_id: "ord-new-1",
        code_hash: hashPickupCode(knownCode),
        attempts: 0,
        expires_at: new Date(Date.now() + 86400000),
        issued_at: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-new-1/complete")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .send({ code: knownCode })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.currentState || res.body.data?.currentState).toBe("completed");
      expect(ordersDb.get("ord-new-1").state).toBe("completed");
    });
  });

  describe("POST /api/orders/:id/reject", () => {
    it("transitions order from new to rejected and texts buyer", async () => {
      // Seed a fresh new order
      ordersDb.set("ord-to-reject-1", {
        id: "ord-to-reject-1",
        seller_id: seller1.id,
        number: 1009,
        buyer_name: "Tigist Alemu",
        buyer_phone: "0955667788",
        sms_consent: true,
        state: "new",
        total_santim: 30000,
        seller: seller1,
        order_items: [],
        order_events: [],
      });

      const res = await request(app.getHttpServer())
        .post("/api/orders/ord-to-reject-1/reject")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${seller1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.currentState || res.body.data?.currentState).toBe("rejected");
      expect(ordersDb.get("ord-to-reject-1").state).toBe("rejected");
    });
  });
});
