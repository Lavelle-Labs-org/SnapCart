import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("Scenario E5: Pickup Code Lock & Reissue Integration Tests (QA-004, #41)", () => {
  let app: INestApplication;
  let mockSMSHub: MockSMSHubServer;
  let mockServerUrl: string;
  let authService: AuthService;
  let sellerSessionCookie: string;
  let seller2SessionCookie: string;

  // Demo seller & product fixtures
  const demoSeller = {
    id: "seller-lock-1",
    business_name: "Bole Artisan Bakery",
    sms_name: "Bole Bakery",
    phone: "0911223344",
    phone_verified_at: new Date(),
    password_hash: "mock_seller_hash",
    slug: "bole-bakery",
    created_at: new Date(),
  };

  const demoSeller2 = {
    id: "seller-lock-2",
    business_name: "Addis Spice Market",
    sms_name: "Spice Market",
    phone: "0922334455",
    phone_verified_at: new Date(),
    password_hash: "mock_seller_hash_2",
    slug: "spice-market",
    created_at: new Date(),
  };

  const demoProduct = {
    id: "prod-lock-1",
    seller_id: demoSeller.id,
    name: "Sourdough Boule",
    price_santim: 35000, // 350 ETB
    available: true,
    deleted_at: null,
    created_at: new Date(),
  };

  // In-memory database tables
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
    // 1. Spin up standalone Mock SMSHub Server on an ephemeral port
    mockSMSHub = new MockSMSHubServer({
      initialBalance: 100,
      defaultOtp: "987654",
    });
    mockServerUrl = await mockSMSHub.start();

    process.env.SMSHUB_API_KEY = "sk_test_qa004_key_zero_credit";
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
          if (where.slug === demoSeller2.slug || where.id === demoSeller2.id) {
            return { ...demoSeller2 };
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
          const k = where.key || where.phone;
          const rc = dbRateCounters.get(k);
          return rc ? { ...rc } : null;
        },
        upsert: async ({ where, create, update }: any) => {
          const k = where.key || where.phone;
          const existing = dbRateCounters.get(k);
          const data = existing
            ? { ...existing, ...update, count: (existing.count || 0) + (update.count?.increment || 1) }
            : { id: `rc-${Date.now()}`, ...create };
          dbRateCounters.set(k, data);
          return { ...data };
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

    const sessionToken2 = await authService.createSessionToken({ sellerId: demoSeller2.id });
    seller2SessionCookie = `${SESSION_COOKIE_NAME}=${sessionToken2}`;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mockSMSHub) {
      await mockSMSHub.stop();
    }
  });

  it("Scenario E5: 5 wrong pickup code attempts lock order, 6th attempt is rejected even if correct, and seller reissue unlocks it with fresh code", async () => {
    const buyerPhone = "0912345678";
    mockSMSHub.reset();

    // 1. Buyer starts checkout draft
    const draftRes = await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        slug: demoSeller.slug,
        buyerName: "Dawit Wolde",
        buyerPhone,
        items: [{ productId: demoProduct.id, quantity: 2 }],
        smsConsent: true,
      });

    expect(draftRes.status).toBe(201);
    expect(draftRes.body.success).toBe(true);
    const draftId = draftRes.body.data.draftId;

    // Buyer receives OTP SMS via SMSHub Verify API
    const draftRecord = dbVerifications.get(draftId);
    expect(draftRecord).toBeDefined();
    const verRecord = mockSMSHub.getVerification(draftRecord.verification_id);
    expect(verRecord).toBeDefined();
    expect(verRecord?.msisdn).toBe(buyerPhone);
    const otpCode = verRecord!.code;
    expect(otpCode).toBe("987654");

    // 2. Buyer verifies checkout and creates order
    const verifyRes = await request(app.getHttpServer())
      .post("/api/checkout/verify")
      .send({ draftId, code: otpCode });

    expect(verifyRes.status).toBe(200);
    const { orderId, orderNumber } = verifyRes.body.data;
    expect(orderId).toBeDefined();

    // Extract seller action token from seller alert SMS
    const sentSms = mockSMSHub.getSentMessages();
    const sellerAlertSms = sentSms.find((m) => m.msisdn === demoSeller.phone);
    expect(sellerAlertSms).toBeDefined();
    const tokenMatch = sellerAlertSms!.text.match(/\/a\/([A-Za-z0-9_-]+)/);
    expect(tokenMatch).not.toBeNull();
    const actionToken = tokenMatch![1];

    // 3. Seller accepts order via action link
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/accept`)
      .send();
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.currentState).toBe("accepted");

    // 4. Seller marks order ready via action link
    const readyRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/ready`)
      .send();
    expect(readyRes.status).toBe(200);
    expect(readyRes.body.data.currentState).toBe("ready");

    // Verify order is now ready and has pickup code generated in DB
    const readyOrder = dbOrders.get(orderId);
    expect(readyOrder.state).toBe("ready");
    const initialPickupCode = dbPickupCodes.get(orderId);
    expect(initialPickupCode).toBeDefined();
    expect(initialPickupCode.attempts).toBe(0);

    // Verify buyer received 'buyer_order_ready' SMS with the 4-digit pickup code
    const msgsAfterReady = mockSMSHub.getSentMessages();
    const buyerReadySms = msgsAfterReady.find(
      (m) => m.msisdn === buyerPhone && m.text.includes(`order #${orderNumber} is ready. Pickup code:`)
    );
    expect(buyerReadySms).toBeDefined();
    const pickupMatch = buyerReadySms!.text.match(/Pickup code:\s*(\d{4})/);
    expect(pickupMatch).not.toBeNull();
    const originalPickupCode = pickupMatch![1];
    expect(originalPickupCode).toMatch(/^\d{4}$/);

    // 5. Test 5 Wrong Pickup Code Attempts (Attempts 1 to 5)
    const wrongCodes = ["0000", "1111", "2222", "3333", "4444"].map((c) =>
      c === originalPickupCode ? "9999" : c
    );

    // Attempts 1 to 4: Each fails with remaining attempts decremented and isLocked = false
    for (let i = 0; i < 4; i++) {
      const attemptNum = i + 1;
      const expectedRemaining = 5 - attemptNum;
      const failRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/complete`)
        .send({ code: wrongCodes[i] });

      expect(failRes.status).toBe(400);
      expect(failRes.body.success).toBe(false);
      expect(failRes.body.error.code).toBe("INVALID_PICKUP_CODE");
      expect(failRes.body.error.remainingAttempts).toBe(expectedRemaining);
      expect(failRes.body.error.isLocked).toBe(false);

      const currentDbPc = dbPickupCodes.get(orderId);
      expect(currentDbPc.attempts).toBe(attemptNum);
    }

    // Attempt 5: 5th wrong code locks the pickup code
    const attempt5Res = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/complete`)
      .send({ code: wrongCodes[4] });

    expect(attempt5Res.status).toBe(400);
    expect(attempt5Res.body.success).toBe(false);
    expect(attempt5Res.body.error.code).toBe("INVALID_PICKUP_CODE");
    expect(attempt5Res.body.error.remainingAttempts).toBe(0);
    expect(attempt5Res.body.error.isLocked).toBe(true);
    expect(attempt5Res.body.error.message).toMatch(/locked after 5 failed attempts/i);

    const lockedDbPc = dbPickupCodes.get(orderId);
    expect(lockedDbPc.attempts).toBe(5);

    // 6. Attempt 6: Rejected even if the CORRECT pickup code is supplied
    const attempt6Res = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/complete`)
      .send({ code: originalPickupCode });

    expect(attempt6Res.status).toBe(400);
    expect(attempt6Res.body.success).toBe(false);
    expect(attempt6Res.body.error.code).toBe("PICKUP_CODE_LOCKED");
    expect(attempt6Res.body.error.remainingAttempts).toBe(0);
    expect(attempt6Res.body.error.isLocked).toBe(true);
    expect(attempt6Res.body.error.message).toMatch(/locked after 5 failed attempts/i);

    // Confirm order state remains 'ready' (not completed)
    expect(dbOrders.get(orderId).state).toBe("ready");

    // 7. Verify Dashboard Channel also rejects locked code
    const dashLockedRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/complete`)
      .set("Cookie", sellerSessionCookie)
      .send({ code: originalPickupCode });

    expect(dashLockedRes.status).toBe(400);
    expect(dashLockedRes.body.error.code).toBe("PICKUP_CODE_LOCKED");

    // 8. Seller Reissues Pickup Code (POST /api/orders/:id/pickup-code/reissue)
    mockSMSHub.reset();
    const reissueRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pickup-code/reissue`)
      .set("Cookie", sellerSessionCookie)
      .send();

    expect(reissueRes.status).toBe(200);
    expect(reissueRes.body.success).toBe(true);
    const newPickupCode = reissueRes.body.data?.pickupCode || reissueRes.body.pickupCode;
    expect(newPickupCode).toMatch(/^\d{4}$/);

    // Verify DB pickup code has attempts reset to 0
    const reissuedDbPc = dbPickupCodes.get(orderId);
    expect(reissuedDbPc.attempts).toBe(0);
    expect(reissuedDbPc.expires_at.getTime()).toBeGreaterThan(Date.now() + 6 * 86400000);

    // Verify audit event logged for reissue
    const events = dbOrderEvents.filter((e) => e.order_id === orderId);
    const reissueEvent = events.find((e) => e.from_state === "ready" && e.to_state === "ready" && e.actor === "seller_dash");
    expect(reissueEvent).toBeDefined();

    // Verify buyer received 'buyer_new_pickup_code' SMS with the new code
    const msgsAfterReissue = mockSMSHub.getSentMessages();
    const buyerNewCodeSms = msgsAfterReissue.find(
      (m) =>
        m.msisdn === buyerPhone &&
        m.text.includes(`new pickup code for order #${orderNumber} is ${newPickupCode}`)
    );
    expect(buyerNewCodeSms).toBeDefined();

    // 9. Successfully Complete Order using Reissued Code
    const completeRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/complete`)
      .send({ code: newPickupCode });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.currentState).toBe("completed");
    expect(completeRes.body.data.previousState).toBe("ready");

    // Verify order is 'completed' in DB
    const completedOrder = dbOrders.get(orderId);
    expect(completedOrder.state).toBe("completed");

    // 10. Verify Terminal State & Action Token Revocation
    // Subsequent action link access must be rejected (404 Not Found / revoked)
    const deadLinkRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/complete`)
      .send({ code: newPickupCode });

    expect(deadLinkRes.status).toBe(404);

    // Reissuing code on completed order returns 409 Conflict
    const deadReissueRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pickup-code/reissue`)
      .set("Cookie", sellerSessionCookie)
      .send();

    expect(deadReissueRes.status).toBe(409);
    expect(deadReissueRes.body.error.code).toBe("CONFLICT");
  });

  it("Security Invariants: Format validation and non-ready state guards", async () => {
    // 1. Create a fresh ready order directly in DB to test validation edge cases
    const testOrderId = `order-guard-${Date.now()}`;
    const testOrder = {
      id: testOrderId,
      seller_id: demoSeller.id,
      number: 8888,
      buyer_name: "Tigist Alemu",
      buyer_phone: "0922334455",
      sms_consent: true,
      state: "ready",
      total_santim: 70000,
      created_at: new Date(),
      seller: demoSeller,
    };
    dbOrders.set(testOrderId, testOrder);

    const testToken = "sat_guard_token_123456789";
    const testTokenHash = crypto.createHash("sha256").update(testToken).digest("hex");
    dbActionTokens.set(testTokenHash, {
      id: `tok-${Date.now()}`,
      order_id: testOrderId,
      token_hash: testTokenHash,
      purpose: "seller_action",
      revoked_at: null,
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    });

    // Hash for valid pickup code "7777"
    const validSecret = process.env.PICKUP_CODE_SECRET || "mock_pickup_code_secret_32_characters_long";
    const validHash = crypto.createHmac("sha256", validSecret).update("7777").digest("hex");
    dbPickupCodes.set(testOrderId, {
      id: `pc-${Date.now()}`,
      order_id: testOrderId,
      code_hash: validHash,
      attempts: 0,
      expires_at: new Date(Date.now() + 86400000),
      issued_at: new Date(),
    });

    // Submitting invalid format (non-4-digit strings) rejected with 400 without incrementing attempts
    const invalidFormats = ["12", "12345", "abcd", "", "12a4"];
    for (const badFormat of invalidFormats) {
      const res = await request(app.getHttpServer())
        .post(`/api/a/${testToken}/complete`)
        .send({ code: badFormat });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/(Pickup code must be exactly 4 digits|Pickup code is required)/i);

      // Verify attempts counter remained untouched at 0
      expect(dbPickupCodes.get(testOrderId).attempts).toBe(0);
    }

    // Unauthorized seller dashboard request returns 401
    const unauthRes = await request(app.getHttpServer())
      .post(`/api/orders/${testOrderId}/pickup-code/reissue`)
      .send();
    expect(unauthRes.status).toBe(401);

    // Reissue on non-ready order (e.g., state = 'new') returns 409 Conflict
    const newOrderId = `order-new-${Date.now()}`;
    dbOrders.set(newOrderId, {
      ...testOrder,
      id: newOrderId,
      state: "new",
    });
    const conflictRes = await request(app.getHttpServer())
      .post(`/api/orders/${newOrderId}/pickup-code/reissue`)
      .set("Cookie", sellerSessionCookie)
      .send();
    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error.code).toBe("CONFLICT");
  });

  it("Dashboard Channel: 5 wrong attempts lock pickup code on dashboard, 6th attempt rejected, seller reissue unlocks and completes handover", async () => {
    // 1. Seed a ready order directly in DB
    const orderId = `order-dash-${Date.now()}`;
    const buyerPhone = "0944556677";
    const testOrder = {
      id: orderId,
      seller_id: demoSeller.id,
      number: 7777,
      buyer_name: "Yonas Girma",
      buyer_phone: buyerPhone,
      sms_consent: true,
      state: "ready",
      total_santim: 45000,
      created_at: new Date(),
      seller: demoSeller,
    };
    dbOrders.set(orderId, testOrder);

    const secret = process.env.PICKUP_CODE_SECRET || "mock_pickup_code_secret_32_characters_long";
    const originalCode = "6391";
    const codeHash = crypto.createHmac("sha256", secret).update(originalCode).digest("hex");
    dbPickupCodes.set(orderId, {
      id: `pc-${Date.now()}`,
      order_id: orderId,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(Date.now() + 7 * 86400000),
      issued_at: new Date(),
    });

    // 2. Submit 5 wrong attempts directly to dashboard completion endpoint
    const wrongCodes = ["9001", "9002", "9003", "9004", "9005"];
    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .post(`/api/orders/${orderId}/complete`)
        .set("Cookie", sellerSessionCookie)
        .send({ code: wrongCodes[i] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_PICKUP_CODE");
      expect(res.body.error.remainingAttempts).toBe(4 - i);
      expect(res.body.error.isLocked).toBe(false);
      expect(dbPickupCodes.get(orderId).attempts).toBe(i + 1);
    }

    // 5th attempt locks the code
    const res5 = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/complete`)
      .set("Cookie", sellerSessionCookie)
      .send({ code: wrongCodes[4] });

    expect(res5.status).toBe(400);
    expect(res5.body.error.code).toBe("INVALID_PICKUP_CODE");
    expect(res5.body.error.remainingAttempts).toBe(0);
    expect(res5.body.error.isLocked).toBe(true);
    expect(dbPickupCodes.get(orderId).attempts).toBe(5);

    // 6th attempt with correct code is rejected due to lock
    const res6 = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/complete`)
      .set("Cookie", sellerSessionCookie)
      .send({ code: originalCode });

    expect(res6.status).toBe(400);
    expect(res6.body.error.code).toBe("PICKUP_CODE_LOCKED");
    expect(res6.body.error.isLocked).toBe(true);

    // 3. Reissue pickup code from dashboard
    mockSMSHub.reset();
    const reissueRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pickup-code/reissue`)
      .set("Cookie", sellerSessionCookie)
      .send();

    expect(reissueRes.status).toBe(200);
    const newCode = reissueRes.body.data?.pickupCode || reissueRes.body.pickupCode;
    expect(newCode).toMatch(/^\d{4}$/);
    expect(newCode).not.toBe(originalCode);
    expect(dbPickupCodes.get(orderId).attempts).toBe(0);

    // 4. Complete handover with reissued code from dashboard
    const completeRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/complete`)
      .set("Cookie", sellerSessionCookie)
      .send({ code: newCode });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(dbOrders.get(orderId).state).toBe("completed");
  });

  it("Cross-Seller Isolation: Seller 2 cannot reissue pickup code or complete Seller 1's order", async () => {
    const orderId = `order-tenant-${Date.now()}`;
    const testOrder = {
      id: orderId,
      seller_id: demoSeller.id,
      number: 9999,
      buyer_name: "Tenant Test",
      buyer_phone: "0911002233",
      sms_consent: true,
      state: "ready",
      total_santim: 50000,
      created_at: new Date(),
      seller: demoSeller,
    };
    dbOrders.set(orderId, testOrder);

    const secret = process.env.PICKUP_CODE_SECRET || "mock_pickup_code_secret_32_characters_long";
    const codeHash = crypto.createHmac("sha256", secret).update("8888").digest("hex");
    dbPickupCodes.set(orderId, {
      id: `pc-${Date.now()}`,
      order_id: orderId,
      code_hash: codeHash,
      attempts: 0,
      expires_at: new Date(Date.now() + 7 * 86400000),
      issued_at: new Date(),
    });

    // Seller 2 attempts to reissue pickup code for Seller 1's order
    const reissueRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/pickup-code/reissue`)
      .set("Cookie", seller2SessionCookie)
      .send();

    expect(reissueRes.status).toBe(403);
    expect(reissueRes.body.error.code).toBe("FORBIDDEN");

    // Seller 2 attempts to complete Seller 1's order
    const completeRes = await request(app.getHttpServer())
      .post(`/api/orders/${orderId}/complete`)
      .set("Cookie", seller2SessionCookie)
      .send({ code: "8888" });

    expect(completeRes.status).toBe(403);
    expect(completeRes.body.error.code).toBe("FORBIDDEN");
  });
});
