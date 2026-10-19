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
import { SMSHubService } from "../../apps/api/src/modules/smshub/smshub.service";
import { MockSMSHubServer } from "../mocks/smshub-server";

describe("Scenario E1: End-to-End Happy Path Integration Test (QA-002, #39)", () => {
  let app: INestApplication;
  let mockSMSHub: MockSMSHubServer;
  let mockServerUrl: string;

  // In-memory data store for the test run
  const demoSeller = {
    id: "seller-happy-1",
    business_name: "Habesha Roastery & Cafe",
    sms_name: "Habesha Cafe",
    phone: "0911223344",
    phone_verified_at: new Date(),
    password_hash: "mock_hash",
    slug: "habesha-roastery",
    created_at: new Date(),
  };

  const demoProduct = {
    id: "prod-happy-1",
    seller_id: demoSeller.id,
    name: "Special Yirgacheffe Roast",
    price_santim: 45000, // 450 ETB
    available: true,
    deleted_at: null,
    created_at: new Date(),
  };

  // In-memory state tables
  const dbVerifications = new Map<string, any>();
  const dbOrders = new Map<string, any>();
  const dbOrderItems: any[] = [];
  const dbOrderEvents: any[] = [];
  const dbPickupCodes = new Map<string, any>();
  const dbActionTokens = new Map<string, any>();
  const dbMessages: any[] = [];

  let prismaMock: any;

  beforeAll(async () => {
    // 1. Start standalone Mock SMSHub Server on an ephemeral port
    mockSMSHub = new MockSMSHubServer({
      initialBalance: 100,
      defaultOtp: "789123",
    });
    mockServerUrl = await mockSMSHub.start();

    // Configure test environment variables
    process.env.SMSHUB_API_KEY = "sk_test_happy_path_key_zero_credit";
    process.env.SMSHUB_MODE = "test";
    process.env.SMSHUB_BASE_URL = mockServerUrl;
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    // 2. Build In-Memory Prisma Service Mock
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
          return { ...order };
        },
        findUnique: async ({ where }: any) => {
          const order = dbOrders.get(where.id);
          if (!order) return null;
          return {
            ...order,
            seller: { ...demoSeller },
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
            seller: { ...demoSeller },
            order_items: dbOrderItems.filter((i) => i.order_id === updated.id),
          };
        },
      },
      orderItem: {
        findMany: async ({ where }: any) => {
          return dbOrderItems.filter((i) => i.order_id === where.order_id);
        },
      },
      orderEvent: {
        create: async ({ data }: any) => {
          const event = { id: `event-${Date.now()}`, created_at: new Date(), ...data };
          dbOrderEvents.push(event);
          return { ...event };
        },
      },
      actionToken: {
        create: async ({ data }: any) => {
          const id = `token-${Date.now()}`;
          const record = { id, revoked_at: null, ...data };
          dbActionTokens.set(data.token_hash, record);
          return { ...record };
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
                  seller: { ...demoSeller },
                  order_items: dbOrderItems.filter((i) => i.order_id === order.id),
                }
              : null,
          };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [hash, record] of dbActionTokens.entries()) {
            if (record.order_id === where.order_id && (!where.revoked_at || record.revoked_at === null)) {
              dbActionTokens.set(hash, { ...record, ...data });
              count++;
            }
          }
          return { count };
        },
      },
      pickupCode: {
        upsert: async ({ where, create, update }: any) => {
          const existing = dbPickupCodes.get(where.order_id);
          const record = existing ? { ...existing, ...update } : { id: `pc-${Date.now()}`, ...create };
          dbPickupCodes.set(where.order_id, record);
          return { ...record };
        },
        findUnique: async ({ where }: any) => {
          const record = dbPickupCodes.get(where.order_id);
          return record ? { ...record } : null;
        },
        update: async ({ where, data }: any) => {
          const existing = dbPickupCodes.get(where.order_id);
          if (!existing) throw new Error("Pickup code not found");
          const updated = { ...existing, ...data };
          dbPickupCodes.set(where.order_id, updated);
          return { ...updated };
        },
      },
      suppressionList: {
        findUnique: async () => null,
      },
      message: {
        create: async ({ data }: any) => {
          const msg = { id: `msg-${Date.now()}`, created_at: new Date(), ...data };
          dbMessages.push(msg);
          return { ...msg };
        },
      },
      $transaction: async (cb: any) => cb(prismaMock),
    };

    // 3. Initialize NestJS testing module
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mockSMSHub) {
      await mockSMSHub.stop();
    }
  });

  it("executes Scenario E1: Full ordering, SMS alerts, state lifecycle, and handover with pickup code", async () => {
    const buyerName = "Abebe Bikila";
    const buyerPhone = "0911223344";

    // -------------------------------------------------------------
    // Step 1: Buyer Guest Checkout (POST /api/checkout)
    // -------------------------------------------------------------
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/checkout")
      .send({
        slug: demoSeller.slug,
        buyerName,
        buyerPhone,
        smsConsent: true,
        consentWording: "Send me SMS updates about this order (Accepted, Ready, and Handover code).",
        items: [{ productId: demoProduct.id, quantity: 2 }],
      });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.success).toBe(true);
    const draftId = checkoutRes.body.data.draftId;
    expect(draftId).toBeDefined();

    // Verify SMS 1: Buyer OTP sent by MockSMSHubServer
    const draftRecord = dbVerifications.get(draftId);
    expect(draftRecord).toBeDefined();
    const verRecord = mockSMSHub.getVerification(draftRecord.verification_id);
    expect(verRecord).toBeDefined();
    expect(verRecord?.msisdn).toBe(buyerPhone);
    const otpCode = verRecord!.code;
    expect(otpCode).toBe("789123");

    // -------------------------------------------------------------
    // Step 2: Buyer Verifies Phone OTP (POST /api/checkout/verify)
    // -------------------------------------------------------------
    const verifyRes = await request(app.getHttpServer())
      .post("/api/checkout/verify")
      .send({
        draftId,
        code: otpCode,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);
    const orderData = verifyRes.body.data;
    const orderId = orderData.orderId;
    const orderNumber = orderData.orderNumber;
    expect(orderId).toBeDefined();
    expect(orderNumber).toBeGreaterThanOrEqual(1001);

    // Verify Order state in DB is 'new'
    const createdOrder = dbOrders.get(orderId);
    expect(createdOrder).toBeDefined();
    expect(createdOrder.state).toBe("new");
    expect(createdOrder.buyer_name).toBe(buyerName);
    expect(createdOrder.total_santim).toBe(90000); // 45000 * 2 = 900 ETB

    // Verify SMS 2: Seller New Order Alert was sent
    const sentMessages = mockSMSHub.getSentMessages();
    const sellerAlertSms = sentMessages.find((m) =>
      m.text.includes(`New order #${orderNumber}`)
    );
    expect(sellerAlertSms).toBeDefined();
    expect(sellerAlertSms?.msisdn).toBe(demoSeller.phone);

    // Extract the raw action token from the seller alert SMS link
    const tokenMatch = sellerAlertSms!.text.match(/\/a\/([A-Za-z0-9_-]+)/);
    expect(tokenMatch).not.toBeNull();
    const actionToken = tokenMatch![1];
    expect(actionToken).toBeDefined();

    // -------------------------------------------------------------
    // Step 3: Seller Accepts Order (POST /api/a/:token/accept)
    // -------------------------------------------------------------
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/accept`)
      .send();

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.success).toBe(true);
    expect(acceptRes.body.data.currentState).toBe("accepted");
    expect(acceptRes.body.data.previousState).toBe("new");

    // Verify Order state in DB transitioned to 'accepted'
    expect(dbOrders.get(orderId).state).toBe("accepted");

    // Verify SMS 3: Buyer Order Accepted was sent
    const updatedMessagesAfterAccept = mockSMSHub.getSentMessages();
    const buyerAcceptedSms = updatedMessagesAfterAccept.find(
      (m) =>
        m.msisdn === buyerPhone &&
        m.text.includes(`order #${orderNumber} accepted`)
    );
    expect(buyerAcceptedSms).toBeDefined();

    // -------------------------------------------------------------
    // Step 4: Seller Marks Order Ready (POST /api/a/:token/ready)
    // -------------------------------------------------------------
    const readyRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/ready`)
      .send();

    expect(readyRes.status).toBe(200);
    expect(readyRes.body.success).toBe(true);
    expect(readyRes.body.data.currentState).toBe("ready");
    expect(readyRes.body.data.previousState).toBe("accepted");
    const rawPickupCode = readyRes.body.data.pickupCode;
    expect(rawPickupCode).toMatch(/^\d{4}$/);

    // Verify Order state in DB transitioned to 'ready'
    expect(dbOrders.get(orderId).state).toBe("ready");

    // Verify pickup code stored in DB as HMAC hash (never plaintext)
    const pickupRecord = dbPickupCodes.get(orderId);
    expect(pickupRecord).toBeDefined();
    expect(pickupRecord.code_hash).not.toBe(rawPickupCode);
    expect(pickupRecord.attempts).toBe(0);

    // Verify SMS 4: Buyer Order Ready with pickup code was sent
    const updatedMessagesAfterReady = mockSMSHub.getSentMessages();
    const buyerReadySms = updatedMessagesAfterReady.find(
      (m) =>
        m.msisdn === buyerPhone &&
        m.text.includes(`order #${orderNumber} is ready`) &&
        m.text.includes(rawPickupCode)
    );
    expect(buyerReadySms).toBeDefined();

    // -------------------------------------------------------------
    // Step 5: Handover Completion with Pickup Code (POST /api/a/:token/complete)
    // -------------------------------------------------------------
    const completeRes = await request(app.getHttpServer())
      .post(`/api/a/${actionToken}/complete`)
      .send({ code: rawPickupCode });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);
    expect(completeRes.body.data.currentState).toBe("completed");
    expect(completeRes.body.data.previousState).toBe("ready");

    // -------------------------------------------------------------
    // Acceptance Criteria Assertions
    // -------------------------------------------------------------

    // 1. Final order state is 'completed'
    expect(dbOrders.get(orderId).state).toBe("completed");

    // 2. Order transitions: new -> accepted -> ready -> completed
    const orderEvents = dbOrderEvents.filter((e) => e.order_id === orderId);
    expect(orderEvents).toHaveLength(4);
    expect(orderEvents.map((e) => `${e.from_state || "initial"}->${e.to_state}`)).toEqual([
      "initial->new",
      "new->accepted",
      "accepted->ready",
      "ready->completed",
    ]);

    // 3. Exactly 4 SMS messages were generated across the entire workflow:
    //    - 1 Phone OTP verification
    //    - 1 Seller new-order alert
    //    - 1 Buyer order accepted notification
    //    - 1 Buyer order ready notification (with pickup code)
    //    - 0 SMS on completion (handover completion is silent per FR-18)
    const allOutboundSms = mockSMSHub.getSentMessages();
    expect(allOutboundSms).toHaveLength(3); // 3 outbound text messages (seller alert, buyer accepted, buyer ready)
    const verificationsCreated = mockSMSHub.getRequests().filter((r) => r.path === "/api/verify/send");
    expect(verificationsCreated).toHaveLength(1); // 1 phone OTP verification request
    // Total SMS interactions generated = 4
    const totalSmsInteractions = allOutboundSms.length + verificationsCreated.length;
    expect(totalSmsInteractions).toBe(4);

    // 4. Action tokens revoked after terminal completed state
    for (const record of dbActionTokens.values()) {
      if (record.order_id === orderId) {
        expect(record.revoked_at).not.toBeNull();
      }
    }
  });
});
