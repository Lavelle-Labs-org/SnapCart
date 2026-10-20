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
import { AuthService } from "../../apps/api/src/modules/auth/auth.service";
import { SESSION_COOKIE_NAME } from "../../apps/api/src/modules/auth/auth.types";
import { MockSMSHubServer } from "../mocks/smshub-server";

describe("Scenarios E7 & E8: Token Invalidation & Idempotent Replay Integration Tests (QA-005, #42)", () => {
  let app: INestApplication;
  let mockSMSHub: MockSMSHubServer;
  let mockServerUrl: string;
  let authService: AuthService;
  let sellerSessionCookie: string;

  const demoSeller = {
    id: "seller-invalidation-1",
    business_name: "Tomoca Coffee Roasters",
    sms_name: "Tomoca Coffee",
    phone: "0911001122",
    phone_verified_at: new Date(),
    password_hash: "mock_password_hash",
    slug: "tomoca-coffee",
    created_at: new Date(),
  };

  const demoProduct = {
    id: "prod-invalidation-1",
    seller_id: demoSeller.id,
    name: "Baraka Blend Beans",
    price_santim: 40000, // 400 ETB
    available: true,
    deleted_at: null,
    created_at: new Date(),
  };

  // In-memory data store
  let dbVerifications: Map<string, any>;
  let dbOrders: Map<string, any>;
  let dbOrderItems: any[];
  let dbOrderEvents: any[];
  let dbPickupCodes: Map<string, any>;
  let dbActionTokens: Map<string, any>;
  let dbMessages: any[];
  let dbSuppressionList: Map<string, any>;
  let dbRateCounters: Map<string, any>;

  let prismaMock: any;

  beforeAll(async () => {
    mockSMSHub = new MockSMSHubServer({
      initialBalance: 100,
      defaultOtp: "123987",
    });
    mockServerUrl = await mockSMSHub.start();

    process.env.SMSHUB_API_KEY = "sk_test_qa005_key_zero_credit";
    process.env.SMSHUB_MODE = "test";
    process.env.SMSHUB_BASE_URL = mockServerUrl;
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";
    delete process.env.SMS_SENDING_PAUSED;
    delete process.env.SMS_ALLOWLIST;

    dbVerifications = new Map();
    dbOrders = new Map();
    dbOrderItems = [];
    dbOrderEvents = [];
    dbPickupCodes = new Map();
    dbActionTokens = new Map();
    dbMessages = [];
    dbSuppressionList = new Map();
    dbRateCounters = new Map();

    prismaMock = {
      $connect: async () => {},
      $disconnect: async () => {},
      seller: {
        findUnique: async ({ where }: any) => {
          if (where.slug === demoSeller.slug || where.id === demoSeller.id) {
            return { ...demoSeller };
          }
          return null;
        },
      },
      product: {
        findMany: async ({ where }: any) => {
          const ids: string[] = where.id?.in || [];
          if (ids.includes(demoProduct.id) && where.seller_id === demoSeller.id) {
            return [{ ...demoProduct }];
          }
          return [];
        },
        findUnique: async ({ where }: any) => {
          if (where.id === demoProduct.id) {
            return { ...demoProduct };
          }
          return null;
        },
      },
      phoneVerification: {
        create: async ({ data }: any) => {
          const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const record = {
            id,
            status: "pending",
            created_at: new Date(),
            last_sent_at: new Date(),
            ...data,
          };
          dbVerifications.set(id, record);
          return { ...record };
        },
        findUnique: async ({ where }: any) => {
          const record = dbVerifications.get(where.id);
          return record ? { ...record } : null;
        },
        update: async ({ where, data }: any) => {
          const existing = dbVerifications.get(where.id);
          if (!existing) throw new Error("Verification not found");
          const updated = { ...existing, ...data };
          dbVerifications.set(where.id, updated);
          return { ...updated };
        },
      },
      order: {
        findFirst: async ({ where }: any) => {
          const matches = Array.from(dbOrders.values()).filter(
            (o) => o.seller_id === where.seller_id
          );
          if (matches.length === 0) return null;
          matches.sort((a, b) => b.number - a.number);
          return { ...matches[0] };
        },
        create: async ({ data }: any) => {
          const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const order = {
            id,
            created_at: new Date(),
            ...data,
            order_items: data.order_items?.create || [],
          };
          dbOrders.set(id, order);

          if (data.order_items?.create) {
            for (const item of data.order_items.create) {
              dbOrderItems.push({ id: `item-${Date.now()}`, order_id: id, ...item });
            }
          }
          if (data.order_events?.create) {
            const eventData = Array.isArray(data.order_events.create)
              ? data.order_events.create
              : [data.order_events.create];
            for (const ev of eventData) {
              dbOrderEvents.push({ id: `event-${Date.now()}`, order_id: id, created_at: new Date(), ...ev });
            }
          }
          if (data.action_tokens?.create) {
            const tokens = Array.isArray(data.action_tokens.create)
              ? data.action_tokens.create
              : [data.action_tokens.create];
            for (const tok of tokens) {
              const record = { id: `token-${Date.now()}`, order_id: id, revoked_at: null, created_at: new Date(), ...tok };
              dbActionTokens.set(tok.token_hash, record);
            }
          }

          return {
            ...order,
            seller: demoSeller,
            order_items: dbOrderItems.filter((i) => i.order_id === id),
            order_events: dbOrderEvents.filter((e) => e.order_id === id),
            pickup_code: null,
          };
        },
        findUnique: async ({ where }: any) => {
          const o = dbOrders.get(where.id);
          if (!o) return null;
          return {
            ...o,
            seller: demoSeller,
            order_items: dbOrderItems.filter((i) => i.order_id === o.id),
            order_events: dbOrderEvents.filter((e) => e.order_id === o.id),
            pickup_code: dbPickupCodes.get(o.id) || null,
          };
        },
        findMany: async ({ where }: any) => {
          return Array.from(dbOrders.values())
            .filter((o) => !where?.seller_id || o.seller_id === where.seller_id)
            .map((o) => ({
              ...o,
              seller: demoSeller,
              order_items: dbOrderItems.filter((i) => i.order_id === o.id),
              pickup_code: dbPickupCodes.get(o.id) || null,
            }));
        },
        update: async ({ where, data }: any) => {
          const existing = dbOrders.get(where.id);
          if (!existing) throw new Error("Order not found");
          const updated = { ...existing, ...data };
          dbOrders.set(where.id, updated);
          return {
            ...updated,
            seller: demoSeller,
            order_items: dbOrderItems.filter((i) => i.order_id === where.id),
            order_events: dbOrderEvents.filter((e) => e.order_id === where.id),
            pickup_code: dbPickupCodes.get(where.id) || null,
          };
        },
      },
      orderItem: {
        createMany: async ({ data }: any) => {
          for (const item of data) {
            dbOrderItems.push({ id: `item-${Date.now()}`, ...item });
          }
          return { count: data.length };
        },
      },
      orderEvent: {
        create: async ({ data }: any) => {
          const ev = { id: `event-${Date.now()}-${Math.random()}`, created_at: new Date(), ...data };
          dbOrderEvents.push(ev);
          return { ...ev };
        },
        findMany: async ({ where }: any) => {
          return dbOrderEvents.filter((e) => !where?.order_id || e.order_id === where.order_id);
        },
      },
      pickupCode: {
        findUnique: async ({ where }: any) => {
          const pc = dbPickupCodes.get(where.order_id);
          return pc ? { ...pc } : null;
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = dbPickupCodes.get(where.order_id);
          const data = existing ? { ...existing, ...update } : { id: `pc-${Date.now()}`, ...create };
          dbPickupCodes.set(where.order_id, data);
          return { ...data };
        },
        update: async ({ where, data }: any) => {
          const existing = dbPickupCodes.get(where.order_id);
          if (!existing) throw new Error("Pickup code not found");
          const updated = { ...existing, ...data };
          dbPickupCodes.set(where.order_id, updated);
          return { ...updated };
        },
      },
      actionToken: {
        findUnique: async ({ where }: any) => {
          const tok = dbActionTokens.get(where.token_hash);
          if (!tok) return null;
          const order = dbOrders.get(tok.order_id);
          return {
            ...tok,
            order: order
              ? {
                  ...order,
                  seller: demoSeller,
                  order_items: dbOrderItems.filter((i) => i.order_id === order.id),
                  pickup_code: dbPickupCodes.get(order.id) || null,
                }
              : null,
          };
        },
        create: async ({ data }: any) => {
          const record = { id: `token-${Date.now()}`, revoked_at: null, created_at: new Date(), ...data };
          dbActionTokens.set(data.token_hash, record);
          return { ...record };
        },
        update: async ({ where, data }: any) => {
          const tok = dbActionTokens.get(where.token_hash);
          if (!tok) throw new Error("Action token not found");
          const updated = { ...tok, ...data };
          dbActionTokens.set(where.token_hash, updated);
          return { ...updated };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [hash, tok] of dbActionTokens.entries()) {
            if (!where.order_id || tok.order_id === where.order_id) {
              if (where.revoked_at !== undefined && tok.revoked_at !== where.revoked_at) {
                continue;
              }
              dbActionTokens.set(hash, { ...tok, ...data });
              count++;
            }
          }
          return { count };
        },
      },
      message: {
        create: async ({ data }: any) => {
          const record = {
            id: `msg-${Date.now()}-${Math.random()}`,
            created_at: new Date(),
            ...data,
          };
          dbMessages.push(record);
          return { ...record };
        },
        findMany: async ({ where }: any) => {
          return dbMessages.filter((m) => {
            if (where.order_id && m.order_id !== where.order_id) return false;
            return true;
          });
        },
        update: async ({ where, data }: any) => {
          const m = dbMessages.find((msg) => msg.id === where.id);
          if (m) Object.assign(m, data);
          return m;
        },
      },
      rateCounter: {
        findUnique: async ({ where }: any) => {
          return dbRateCounters.get(where.key || where.phone) || null;
        },
        upsert: async ({ where, create, update }: any) => {
          const k = where.key || where.phone;
          const existing = dbRateCounters.get(k);
          if (existing) {
            const count = update.count?.increment ? existing.count + update.count.increment : update.count;
            const updated = { ...existing, count };
            dbRateCounters.set(k, updated);
            return updated;
          }
          const created = { ...create };
          dbRateCounters.set(k, created);
          return created;
        },
      },
      suppressionList: {
        findUnique: async ({ where }: any) => {
          const s = dbSuppressionList.get(where.phone);
          return s ? { ...s } : null;
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = dbSuppressionList.get(where.phone);
          const data = existing ? { ...existing, ...update } : { id: `sup-${Date.now()}`, ...create };
          dbSuppressionList.set(where.phone, data);
          return { ...data };
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

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    authService = app.get(AuthService);
    const sessionToken = await authService.createSessionToken({ sellerId: demoSeller.id });
    sellerSessionCookie = `${SESSION_COOKIE_NAME}=${sessionToken}`;
  });

  beforeEach(() => {
    dbVerifications = new Map();
    dbOrders = new Map();
    dbOrderItems = [];
    dbOrderEvents = [];
    dbPickupCodes = new Map();
    dbActionTokens = new Map();
    dbMessages = [];
    dbSuppressionList = new Map();
    dbRateCounters = new Map();
    mockSMSHub.reset();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mockSMSHub) {
      await mockSMSHub.stop();
    }
  });

  it("Scenario E7: Idempotent Replay (repeated action link and dashboard taps return current state without duplicate SMS or event logs)", async () => {
    const buyerPhone = "0911554433";
    mockSMSHub.reset();

    // 1. Checkout & verification
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        slug: demoSeller.slug,
        buyerName: "Meron Hailu",
        buyerPhone,
        items: [{ productId: demoProduct.id, quantity: 1 }],
        smsConsent: true,
      });

    expect(checkoutRes.status).toBe(201);
    const draftId = checkoutRes.body.data.draftId;

    const draftRecord = dbVerifications.get(draftId);
    expect(draftRecord).toBeDefined();
    const verRecord = mockSMSHub.getVerification(draftRecord.verification_id);
    expect(verRecord).toBeDefined();

    const verifyRes = await request(app.getHttpServer())
      .post("/api/checkout/verify")
      .send({ draftId, code: verRecord!.code });

    expect(verifyRes.status).toBe(200);
    const { orderId, orderNumber } = verifyRes.body.data;

    // Retrieve seller action token from seller new order alert SMS
    const sentSms = mockSMSHub.getSentMessages();
    const sellerAlertSms = sentSms.find((m) => m.msisdn === demoSeller.phone);
    expect(sellerAlertSms).toBeDefined();
    const tokenMatch = sellerAlertSms!.text.match(/\/a\/([A-Za-z0-9_-]+)/);
    expect(tokenMatch).not.toBeNull();
    const actionToken = tokenMatch![1];

    // 2. First Tap: Accept Order
    const firstAcceptRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/accept`)
      .send();

    expect(firstAcceptRes.status).toBe(200);
    expect(firstAcceptRes.body.success).toBe(true);
    expect(firstAcceptRes.body.data.isIdempotent).toBe(false);
    expect(firstAcceptRes.body.data.currentState).toBe("accepted");
    expect(firstAcceptRes.body.data.previousState).toBe("new");

    // Count SMS messages after first accept
    const smsCountAfterFirstAccept = mockSMSHub.getSentMessages().length;
    const buyerAcceptSms = mockSMSHub
      .getSentMessages()
      .filter((m) => m.msisdn === buyerPhone && m.text.includes(`order #${orderNumber} accepted`));
    expect(buyerAcceptSms.length).toBe(1);

    // Count audit events for this order
    const eventsAfterFirstAccept = dbOrderEvents.filter((e) => e.order_id === orderId).length;

    // 3. Second Tap: Repeated Accept (Idempotent Replay)
    const secondAcceptRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/accept`)
      .send();

    expect(secondAcceptRes.status).toBe(200);
    expect(secondAcceptRes.body.success).toBe(true);
    expect(secondAcceptRes.body.data.isIdempotent).toBe(true);
    expect(secondAcceptRes.body.data.currentState).toBe("accepted");
    expect(secondAcceptRes.body.data.previousState).toBe("accepted");

    // Invariant: Zero duplicate SMS sent
    expect(mockSMSHub.getSentMessages().length).toBe(smsCountAfterFirstAccept);

    // Invariant: Zero duplicate audit events logged
    expect(dbOrderEvents.filter((e) => e.order_id === orderId).length).toBe(eventsAfterFirstAccept);

    // 4. Third Tap: Repeated Accept via Dashboard (Dashboard Idempotent Replay)
    const dashAcceptRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/accept`)
      .set("Cookie", sellerSessionCookie)
      .send();

    expect(dashAcceptRes.status).toBe(200);
    expect(dashAcceptRes.body.success).toBe(true);
    expect(dashAcceptRes.body.data?.isIdempotent || dashAcceptRes.body.isIdempotent).toBe(true);
    expect(dashAcceptRes.body.data?.currentState || dashAcceptRes.body.currentState).toBe("accepted");

    // Still zero additional SMS and zero additional event rows
    expect(mockSMSHub.getSentMessages().length).toBe(smsCountAfterFirstAccept);
    expect(dbOrderEvents.filter((e) => e.order_id === orderId).length).toBe(eventsAfterFirstAccept);

    // 5. Transition to Ready: First Tap vs Second Tap
    const firstReadyRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/ready`)
      .send();

    expect(firstReadyRes.status).toBe(200);
    expect(firstReadyRes.body.data.isIdempotent).toBe(false);
    expect(firstReadyRes.body.data.currentState).toBe("ready");

    const smsCountAfterFirstReady = mockSMSHub.getSentMessages().length;
    expect(smsCountAfterFirstReady).toBe(smsCountAfterFirstAccept + 1);

    // Second tap on Ready (Idempotent Replay)
    const secondReadyRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/ready`)
      .send();

    expect(secondReadyRes.status).toBe(200);
    expect(secondReadyRes.body.data.isIdempotent).toBe(true);
    expect(secondReadyRes.body.data.currentState).toBe("ready");

    // Invariant: Zero duplicate ready SMS dispatched
    expect(mockSMSHub.getSentMessages().length).toBe(smsCountAfterFirstReady);
  });

  it("Scenario E8: Dead / Expired Action Links are rejected without exposing order data (Terminal State & 48h Expiration)", async () => {
    // -------------------------------------------------------------
    // Part A: Action Token Invalidation after Order Rejection
    // -------------------------------------------------------------
    const buyerPhoneA = "0922114455";
    mockSMSHub.reset();

    const checkoutResA = await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        slug: demoSeller.slug,
        buyerName: "Bereket Tadesse",
        buyerPhone: buyerPhoneA,
        items: [{ productId: demoProduct.id, quantity: 1 }],
        smsConsent: true,
      });

    const draftIdA = checkoutResA.body.data.draftId;
    const verRecordA = mockSMSHub.getVerification(dbVerifications.get(draftIdA).verification_id);

    const verifyResA = await request(app.getHttpServer())
      .post("/api/checkout/verify")
      .send({ draftId: draftIdA, code: verRecordA!.code });

    const orderIdA = verifyResA.body.data.orderId;
    const sellerAlertA = mockSMSHub.getSentMessages().find((m) => m.msisdn === demoSeller.phone);
    const actionTokenA = sellerAlertA!.text.match(/\/a\/([A-Za-z0-9_-]+)/)![1];

    // Seller rejects the order
    const rejectRes = await request(app.getHttpServer())
      .post(`/api/a/${actionTokenA}/reject`)
      .send();
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.currentState).toBe("rejected");

    // Invariant: Token is permanently revoked in DB
    const tokenHashA = crypto.createHash("sha256").update(actionTokenA).digest("hex");
    const dbTokenA = dbActionTokens.get(tokenHashA);
    expect(dbTokenA.revoked_at).not.toBeNull();

    // Invariant: Opening dead action link via GET returns 404 without exposing order payload
    const deadGetA = await request(app.getHttpServer())
      .get(`/api/a/${actionTokenA}`);

    expect(deadGetA.status).toBe(404);
    expect(deadGetA.body.success).toBe(false);
    expect(deadGetA.body.error.message).toMatch(/revoked or already completed/i);
    expect(deadGetA.body.data).toBeUndefined();
    expect(deadGetA.body.order).toBeUndefined();

    // Invariant: Subsequent mutation attempts on revoked token return 404
    const deadAcceptA = await request(app.getHttpServer())
      .post(`/api/a/${actionTokenA}/accept`)
      .send();
    expect(deadAcceptA.status).toBe(404);

    const deadReadyA = await request(app.getHttpServer())
      .post(`/api/a/${actionTokenA}/ready`)
      .send();
    expect(deadReadyA.status).toBe(404);

    const deadRejectA = await request(app.getHttpServer())
      .post(`/api/a/${actionTokenA}/reject`)
      .send();
    expect(deadRejectA.status).toBe(404);

    // -------------------------------------------------------------
    // Part B: Action Token Invalidation after Order Completion
    // -------------------------------------------------------------
    const buyerPhoneB = "0933221100";
    mockSMSHub.reset();

    const checkoutResB = await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        slug: demoSeller.slug,
        buyerName: "Solomon Kassa",
        buyerPhone: buyerPhoneB,
        items: [{ productId: demoProduct.id, quantity: 1 }],
        smsConsent: true,
      });

    const draftIdB = checkoutResB.body.data.draftId;
    const verRecordB = mockSMSHub.getVerification(dbVerifications.get(draftIdB).verification_id);

    const verifyResB = await request(app.getHttpServer())
      .post("/api/checkout/verify")
      .send({ draftId: draftIdB, code: verRecordB!.code });

    expect(verifyResB.status).toBe(200);

    const orderIdB = verifyResB.body.data.orderId;
    const orderNumberB = verifyResB.body.data.orderNumber;
    const sentMessagesB = mockSMSHub.getSentMessages();
    const sellerAlertB = sentMessagesB.find((m) => m.msisdn === demoSeller.phone);
    expect(sellerAlertB).toBeDefined();
    const actionTokenB = sellerAlertB!.text.match(/\/a\/([A-Za-z0-9_-]+)/)![1];

    // Progress to ready
    await request(app.getHttpServer()).post(`/api/a/${actionTokenB}/accept`).send();
    await request(app.getHttpServer()).post(`/api/a/${actionTokenB}/ready`).send();

    // Extract pickup code
    const buyerReadySms = mockSMSHub.getSentMessages().find(
      (m) => m.msisdn === buyerPhoneB && m.text.includes(`order #${orderNumberB} is ready. Pickup code:`)
    );
    const pickupCode = buyerReadySms!.text.match(/Pickup code:\s*(\d{4})/)![1];

    // Complete order with valid code
    const completeRes = await request(app.getHttpServer())
      .post(`/api/a/${actionTokenB}/complete`)
      .send({ code: pickupCode });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.currentState).toBe("completed");

    // Invariant: Action token is revoked upon completion
    const tokenHashB = crypto.createHash("sha256").update(actionTokenB).digest("hex");
    expect(dbActionTokens.get(tokenHashB).revoked_at).not.toBeNull();

    // Invariant: GET /api/a/:token returns 404 after completion without exposing order data
    const deadGetB = await request(app.getHttpServer())
      .get(`/api/a/${actionTokenB}`);

    expect(deadGetB.status).toBe(404);
    expect(deadGetB.body.error.message).toMatch(/revoked or already completed/i);
    expect(deadGetB.body.data).toBeUndefined();

    // Invariant: Further POST /api/a/:token/complete returns 404
    const deadCompleteB = await request(app.getHttpServer())
      .post(`/api/a/${actionTokenB}/complete`)
      .send({ code: pickupCode });

    expect(deadCompleteB.status).toBe(404);

    // -------------------------------------------------------------
    // Part C: Expired Action Links (> 48h validity window)
    // -------------------------------------------------------------
    const expiredOrderId = `order-expired-${Date.now()}`;
    dbOrders.set(expiredOrderId, {
      id: expiredOrderId,
      seller_id: demoSeller.id,
      number: 7771,
      buyer_name: "Expired Link User",
      buyer_phone: "0955667788",
      sms_consent: true,
      state: "new",
      total_santim: 25000,
      created_at: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50h ago
      seller: demoSeller,
    });

    const expiredToken = "sat_expired_link_123456789";
    const expiredTokenHash = crypto.createHash("sha256").update(expiredToken).digest("hex");
    dbActionTokens.set(expiredTokenHash, {
      id: `tok-expired-${Date.now()}`,
      order_id: expiredOrderId,
      purpose: "seller_action",
      token_hash: expiredTokenHash,
      revoked_at: null,
      expires_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // expired 2h ago (past 48h limit)
      created_at: new Date(Date.now() - 50 * 60 * 60 * 1000),
    });

    // Invariant: GET on expired link returns 404 "Action link has expired" without leaking order data
    const expiredGetRes = await request(app.getHttpServer())
      .get(`/api/a/${expiredToken}`);

    expect(expiredGetRes.status).toBe(404);
    expect(expiredGetRes.body.error.message).toMatch(/Action link has expired/i);
    expect(expiredGetRes.body.data).toBeUndefined();

    // Invariant: POST on expired link returns 404
    const expiredPostRes = await request(app.getHttpServer())
      .post(`/api/a/${expiredToken}/accept`)
      .send();

    expect(expiredPostRes.status).toBe(404);
    expect(expiredPostRes.body.error.message).toMatch(/Action link has expired/i);

    // -------------------------------------------------------------
    // Part D: Forged / Unknown Tokens & Purpose Separation
    // -------------------------------------------------------------
    // 1. Unknown / forged token returns 404
    const fakeRes = await request(app.getHttpServer())
      .get("/api/a/completely_fake_nonexistent_token_xyz");

    expect(fakeRes.status).toBe(404);
    expect(fakeRes.body.error.message).toMatch(/Invalid or unknown action token/i);

    // 2. Token issued for buyer opt-out ('buyer_stop') cannot be used for seller actions
    const stopOrderId = `order-stop-${Date.now()}`;
    dbOrders.set(stopOrderId, {
      id: stopOrderId,
      seller_id: demoSeller.id,
      number: 7772,
      buyer_name: "Stop Token User",
      buyer_phone: "0966778899",
      sms_consent: true,
      state: "accepted",
      total_santim: 30000,
      created_at: new Date(),
      seller: demoSeller,
    });

    const stopToken = "sat_buyer_stop_only_token_456";
    const stopTokenHash = crypto.createHash("sha256").update(stopToken).digest("hex");
    dbActionTokens.set(stopTokenHash, {
      id: `tok-stop-${Date.now()}`,
      order_id: stopOrderId,
      purpose: "buyer_stop", // Wrong purpose for seller action
      token_hash: stopTokenHash,
      revoked_at: null,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
      created_at: new Date(),
    });

    const wrongPurposeRes = await request(app.getHttpServer())
      .get(`/api/a/${stopToken}`);

    expect(wrongPurposeRes.status).toBe(404);
    expect(wrongPurposeRes.body.error.message).toMatch(/Invalid action token purpose/i);
  });
});
