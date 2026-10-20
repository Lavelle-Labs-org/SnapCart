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

describe("Rejection & Opt-Out Integration Tests (QA-003, Issue #40)", () => {
  let app: INestApplication;
  let mockSMSHub: MockSMSHubServer;
  let mockServerUrl: string;

  const demoSeller = {
    id: "seller-qa003-1",
    business_name: "Habesha Roastery & Cafe",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    phone_verified_at: new Date(),
    password_hash: "mock_hash",
    slug: "habesha-qa",
    created_at: new Date(),
  };

  const demoProduct = {
    id: "prod-qa003-1",
    seller_id: demoSeller.id,
    name: "Special Yirgacheffe Roast",
    price_santim: 45000, // 450 ETB
    available: true,
    deleted_at: null,
    created_at: new Date(),
  };

  // In-memory state tables
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
      defaultOtp: "654321",
    });
    mockServerUrl = await mockSMSHub.start();

    process.env.SMSHUB_API_KEY = "sk_test_qa003_key_zero_credit";
    process.env.SMSHUB_MODE = "test";
    process.env.SMSHUB_BASE_URL = mockServerUrl;
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";
    delete process.env.SMS_SENDING_PAUSED;
    delete process.env.SMS_ALLOWLIST;

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
          return { ...order, seller: demoSeller };
        },
        findUnique: async ({ where }: any) => {
          const order = dbOrders.get(where.id);
          if (!order) return null;
          return {
            ...order,
            seller: demoSeller,
            order_items: dbOrderItems.filter((i) => i.order_id === order.id),
            pickup_code: dbPickupCodes.get(order.id) || null,
          };
        },
        update: async ({ where, data }: any) => {
          const existing = dbOrders.get(where.id);
          if (!existing) throw new Error("Order not found");
          const updated = { ...existing, ...data };
          dbOrders.set(where.id, updated);
          return {
            ...updated,
            seller: demoSeller,
            order_items: dbOrderItems.filter((i) => i.order_id === existing.id),
          };
        },
      },
      orderEvent: {
        create: async ({ data }: any) => {
          const ev = { id: `event-${Date.now()}`, created_at: new Date(), ...data };
          dbOrderEvents.push(ev);
          return { ...ev };
        },
      },
      pickupCode: {
        findUnique: async ({ where }: any) => {
          const record = dbPickupCodes.get(where.order_id);
          return record ? { ...record } : null;
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = dbPickupCodes.get(where.order_id);
          const record = existing ? { ...existing, ...update } : { ...create };
          dbPickupCodes.set(where.order_id, record);
          return { ...record };
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
        create: async ({ data }: any) => {
          const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const tokenRecord = {
            id,
            revoked_at: null,
            created_at: new Date(),
            ...data,
          };
          dbActionTokens.set(tokenRecord.token_hash, tokenRecord);
          return { ...tokenRecord };
        },
        findUnique: async ({ where }: any) => {
          const record = dbActionTokens.get(where.token_hash);
          if (!record) return null;
          const order = dbOrders.get(record.order_id);
          return {
            ...record,
            order: order
              ? {
                  ...order,
                  seller: demoSeller,
                  order_items: dbOrderItems.filter((i) => i.order_id === order.id),
                }
              : null,
          };
        },
        update: async ({ where, data }: any) => {
          let targetKey: string | null = null;
          for (const [key, val] of dbActionTokens.entries()) {
            if (val.id === where.id || val.token_hash === where.token_hash) {
              targetKey = key;
              break;
            }
          }
          if (!targetKey) throw new Error("Action token not found");
          const existing = dbActionTokens.get(targetKey);
          const updated = { ...existing, ...data };
          dbActionTokens.set(targetKey, updated);
          return { ...updated };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [key, val] of dbActionTokens.entries()) {
            if (val.order_id === where.order_id && (!where.revoked_at || val.revoked_at === null)) {
              dbActionTokens.set(key, { ...val, ...data });
              count++;
            }
          }
          return { count };
        },
      },
      suppressionList: {
        findUnique: async ({ where }: any) => {
          const record = dbSuppressionList.get(where.phone);
          return record ? { ...record } : null;
        },
        create: async ({ data }: any) => {
          dbSuppressionList.set(data.phone, { ...data, created_at: new Date() });
          return dbSuppressionList.get(data.phone);
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = dbSuppressionList.get(where.phone);
          if (existing) {
            const updated = { ...existing, ...update };
            dbSuppressionList.set(where.phone, updated);
            return updated;
          }
          const created = { ...create, created_at: new Date() };
          dbSuppressionList.set(where.phone, created);
          return created;
        },
      },
      rateCounter: {
        findUnique: async ({ where }: any) => {
          return dbRateCounters.get(where.key) || null;
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = dbRateCounters.get(where.key);
          if (existing) {
            const count = update.count?.increment ? existing.count + update.count.increment : update.count;
            const updated = { ...existing, count };
            dbRateCounters.set(where.key, updated);
            return updated;
          }
          const created = { ...create };
          dbRateCounters.set(where.key, created);
          return created;
        },
      },
      message: {
        create: async ({ data }: any) => {
          const msg = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            created_at: new Date(),
            ...data,
          };
          dbMessages.push(msg);
          return { ...msg };
        },
        findMany: async () => [...dbMessages],
      },
      $transaction: async (cbOrPromises: any) => {
        if (typeof cbOrPromises === "function") {
          return cbOrPromises(prismaMock);
        }
        return Promise.all(cbOrPromises);
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mockSMSHub) await mockSMSHub.stop();
  });

  beforeEach(() => {
    // Reset state before each test
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

  // =========================================================================
  // Scenario E2: Order Rejection Workflow (QA-003, #40)
  // =========================================================================
  describe("Scenario E2: Order Rejection (FR-18, Invariant #1)", () => {
    it("seller rejects order via SMS link; buyer receives rejection text; state machine terminates in 'rejected'", async () => {
      const buyerPhone = "0922334455";

      // 1. Initiate Checkout
      const checkoutRes = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: demoSeller.slug,
          buyerName: "Bereket Tadesse",
          buyerPhone,
          smsConsent: true,
          consentWording: "I agree to receive order status updates via SMS.",
          items: [{ productId: demoProduct.id, quantity: 1 }],
        });

      expect(checkoutRes.status).toBe(201);
      const draftId = checkoutRes.body.data.draftId;

      // 2. Complete Phone Verification (OTP)
      const verifyRes = await request(app.getHttpServer())
        .post("/api/checkout/verify")
        .send({ draftId, code: "654321" });

      expect(verifyRes.status).toBe(200);
      const { orderId, orderNumber } = verifyRes.body.data;

      // Extract raw action token from seller's incoming new order alert
      const sentSms = mockSMSHub.getSentMessages();
      const sellerAlertSms = sentSms.find((m) => m.msisdn === demoSeller.phone);
      expect(sellerAlertSms).toBeDefined();

      const tokenMatch = sellerAlertSms!.text.match(/\/a\/([A-Za-z0-9_-]+)/);
      expect(tokenMatch).not.toBeNull();
      const actionToken = tokenMatch![1];

      // 3. Seller Rejects the Order (POST /api/a/:token/reject)
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/reject`)
        .send();

      expect(rejectRes.status).toBe(200);
      expect(rejectRes.body.success).toBe(true);
      expect(rejectRes.body.data.currentState).toBe("rejected");
      expect(rejectRes.body.data.previousState).toBe("new");

      // Verify order state in DB is 'rejected'
      const updatedOrder = dbOrders.get(orderId);
      expect(updatedOrder.state).toBe("rejected");

      // Verify audit transitions logged: initial->new, new->rejected
      const orderEvents = dbOrderEvents.filter((e) => e.order_id === orderId);
      expect(orderEvents.map((e) => `${e.from_state || "initial"}->${e.to_state}`)).toEqual([
        "initial->new",
        "new->rejected",
      ]);

      // 4. Verify Buyer receives the rejection SMS notification
      const messagesAfterReject = mockSMSHub.getSentMessages();
      const buyerRejectionSms = messagesAfterReject.find(
        (m) =>
          m.msisdn === buyerPhone &&
          m.text.includes(`order #${orderNumber} was not accepted`)
      );
      expect(buyerRejectionSms).toBeDefined();

      // 5. Verify action tokens for this order are revoked (terminal state enforcement)
      for (const record of dbActionTokens.values()) {
        if (record.order_id === orderId) {
          expect(record.revoked_at).not.toBeNull();
        }
      }

      // 6. Verify subsequent attempts to use the action link are rejected with 404
      const replayRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/accept`)
        .send();

      expect(replayRes.status).toBe(404);
      expect(replayRes.body.error.code).toBe("NOT_FOUND");
    });
  });

  // =========================================================================
  // Scenario E3: Unconsented Checkout Workflow (QA-003, #40)
  // =========================================================================
  describe("Scenario E3: Unconsented Checkout (FR-7, Invariant #7)", () => {
    it("buyer leaves consent unticked: OTP code is sent, but subsequent buyer SMS messages are skipped and logged", async () => {
      const buyerPhone = "0933445566";

      // 1. Initiate Checkout with smsConsent = false
      const checkoutRes = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: demoSeller.slug,
          buyerName: "Sara Hailu",
          buyerPhone,
          smsConsent: false,
          consentWording: "I agree to receive order status updates via SMS.",
          items: [{ productId: demoProduct.id, quantity: 2 }],
        });

      expect(checkoutRes.status).toBe(201);
      const draftId = checkoutRes.body.data.draftId;

      // 2. Complete Phone Verification (OTP is sent regardless of consent per FR-7)
      const verifyRes = await request(app.getHttpServer())
        .post("/api/checkout/verify")
        .send({ draftId, code: "654321" });

      expect(verifyRes.status).toBe(200);
      const { orderId, orderNumber } = verifyRes.body.data;

      // Verify order was stored with sms_consent = false
      const orderInDb = dbOrders.get(orderId);
      expect(orderInDb.sms_consent).toBe(false);

      // Seller receives transaction alert SMS
      const sentSms = mockSMSHub.getSentMessages();
      const sellerAlertSms = sentSms.find((m) => m.msisdn === demoSeller.phone);
      expect(sellerAlertSms).toBeDefined();

      const tokenMatch = sellerAlertSms!.text.match(/\/a\/([A-Za-z0-9_-]+)/);
      expect(tokenMatch).not.toBeNull();
      const actionToken = tokenMatch![1];

      // Reset outbound messages tracker to monitor buyer SMS
      mockSMSHub.reset();

      // 3. Seller Accepts Order (POST /api/a/:token/accept)
      const acceptRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/accept`)
        .send();

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.currentState).toBe("accepted");

      // Verify NO SMS was dispatched to the buyer because consent was unticked
      const messagesAfterAccept = mockSMSHub.getSentMessages();
      const buyerAcceptedSms = messagesAfterAccept.find((m) => m.msisdn === buyerPhone);
      expect(buyerAcceptedSms).toBeUndefined();

      // Verify audit log recorded the skip with reason 'opted_out'
      const skippedAcceptedMsg = dbMessages.find(
        (m) =>
          m.order_id === orderId &&
          m.event === "buyer_order_accepted" &&
          m.status === "skipped" &&
          m.skip_reason === "opted_out"
      );
      expect(skippedAcceptedMsg).toBeDefined();

      // 4. Seller Marks Order Ready (POST /api/a/:token/ready)
      const readyRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/ready`)
        .send();

      expect(readyRes.status).toBe(200);
      expect(readyRes.body.data.currentState).toBe("ready");
      const pickupCode = readyRes.body.data.pickupCode;
      expect(pickupCode).toMatch(/^\d{4}$/);

      // Verify NO ready SMS was dispatched to the buyer
      const messagesAfterReady = mockSMSHub.getSentMessages();
      const buyerReadySms = messagesAfterReady.find((m) => m.msisdn === buyerPhone);
      expect(buyerReadySms).toBeUndefined();

      // Verify audit log recorded the skip for buyer_order_ready
      const skippedReadyMsg = dbMessages.find(
        (m) =>
          m.order_id === orderId &&
          m.event === "buyer_order_ready" &&
          m.status === "skipped" &&
          m.skip_reason === "opted_out"
      );
      expect(skippedReadyMsg).toBeDefined();

      // 5. Complete Handover with Pickup Code (POST /api/a/:token/complete)
      const completeRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/complete`)
        .send({ code: pickupCode });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.currentState).toBe("completed");

      // Order completed normally without blocking workflow
      expect(dbOrders.get(orderId).state).toBe("completed");
    });
  });

  // =========================================================================
  // Scenario E4: Opt-Out via Stop Link Workflow (QA-003, #40)
  // =========================================================================
  describe("Scenario E4: Opt-Out via Stop Link (FR-33, FR-34, Invariant #7)", () => {
    it("buyer clicks stop link in accepted SMS: phone is added to suppression_list and ready SMS is skipped", async () => {
      const buyerPhone = "0944556677";

      // 1. Complete Checkout with Consent
      const checkoutRes = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: demoSeller.slug,
          buyerName: "Dawit Kebede",
          buyerPhone,
          smsConsent: true,
          consentWording: "I agree to receive order status updates via SMS.",
          items: [{ productId: demoProduct.id, quantity: 1 }],
        });

      const draftId = checkoutRes.body.data.draftId;

      const verifyRes = await request(app.getHttpServer())
        .post("/api/checkout/verify")
        .send({ draftId, code: "654321" });

      expect(verifyRes.status).toBe(200);
      const { orderId, orderNumber } = verifyRes.body.data;

      // Extract seller action link
      const sentSms = mockSMSHub.getSentMessages();
      const sellerAlertSms = sentSms.find((m) => m.msisdn === demoSeller.phone);
      const actionToken = sellerAlertSms!.text.match(/\/a\/([A-Za-z0-9_-]+)/)![1];

      // 2. Seller Accepts Order (POST /api/a/:token/accept)
      const acceptRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/accept`)
        .send();

      expect(acceptRes.status).toBe(200);
      expect(acceptRes.body.data.currentState).toBe("accepted");

      // Verify Buyer receives accepted notification with the stop link /x/{token}
      const messagesAfterAccept = mockSMSHub.getSentMessages();
      const buyerAcceptedSms = messagesAfterAccept.find(
        (m) =>
          m.msisdn === buyerPhone &&
          m.text.includes(`order #${orderNumber} accepted`)
      );
      expect(buyerAcceptedSms).toBeDefined();

      const stopTokenMatch = buyerAcceptedSms!.text.match(/\/x\/([A-Za-z0-9_-]+)/);
      expect(stopTokenMatch).not.toBeNull();
      const stopToken = stopTokenMatch![1];

      // 3. Buyer previews and clicks Stop Link (POST /api/stop/:token)
      const previewRes = await request(app.getHttpServer())
        .get(`/api/stop/${stopToken}`)
        .expect(200);

      expect(previewRes.body.success).toBe(true);
      expect(previewRes.body.data.maskedPhone).toContain("••");

      const optOutRes = await request(app.getHttpServer())
        .post(`/api/stop/${stopToken}`)
        .expect(200);

      expect(optOutRes.body.success).toBe(true);
      expect(optOutRes.body.data.suppressed).toBe(true);

      // Verify phone is now in suppression_list
      const suppressionRecord = dbSuppressionList.get(buyerPhone);
      expect(suppressionRecord).toBeDefined();
      expect(suppressionRecord.phone).toBe(buyerPhone);

      // Reset outbound tracker before marking ready
      mockSMSHub.reset();

      // 4. Seller Marks Order Ready (POST /api/a/:token/ready)
      const readyRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/ready`)
        .send();

      expect(readyRes.status).toBe(200);
      expect(readyRes.body.data.currentState).toBe("ready");
      const pickupCode = readyRes.body.data.pickupCode;

      // Verify Ready SMS was SKIPPED because phone is suppressed
      const messagesAfterReady = mockSMSHub.getSentMessages();
      const readySms = messagesAfterReady.find((m) => m.msisdn === buyerPhone);
      expect(readySms).toBeUndefined();

      // Verify audit log captured the suppression
      const skippedReadyMsg = dbMessages.find(
        (m) =>
          m.order_id === orderId &&
          m.event === "buyer_order_ready" &&
          m.status === "skipped" &&
          m.skip_reason === "opted_out"
      );
      expect(skippedReadyMsg).toBeDefined();

      // 5. Complete Handover
      const completeRes = await request(app.getHttpServer())
        .post(`/api/a/${actionToken}/complete`)
        .send({ code: pickupCode });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.currentState).toBe("completed");
      expect(dbOrders.get(orderId).state).toBe("completed");
    });
  });
});
