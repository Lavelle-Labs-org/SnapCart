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
import { SMSHubService } from "../../apps/api/src/modules/smshub/smshub.service";
import { MockSMSHubServer } from "../mocks/smshub-server";

/**
 * End-to-End Gateway Failure Scenarios & Resilience Test Suite (QA-007, Issue #44)
 * Verifies application resilience when SMSHub returns 502 Bad Gateway, 429 Rate Limit,
 * or network timeout:
 *
 * 1. 502 Bad Gateway retries 3x, then logs message row as 'failed' with active resend button.
 * 2. Order state remains safely committed and preserved in database despite SMS failures.
 * 3. Transient 502 Bad Gateway recovers smoothly on subsequent retry.
 * 4. 429 Rate Limited handles Retry-After and fails safely if exhausted, allowing manual resend.
 * 5. Network timeout does not corrupt order state and logs retryable message failure.
 * 6. Order placement and verification remain successful even if seller alert SMS encounters 502.
 */
describe("Scenario QA-007: Simulated Gateway Failure & Retry Tests (Issue #44)", () => {
  let app: INestApplication;
  let mockSMSHub: MockSMSHubServer;
  let mockServerUrl: string;
  let authService: AuthService;
  let sellerSessionCookie: string;

  // Demo seller & product fixtures
  const demoSeller = {
    id: "seller-fail-1",
    business_name: "Lucy Gourmet Roastery",
    sms_name: "Lucy Cafe",
    phone: "0911223344",
    phone_verified_at: new Date(),
    password_hash: "mock_seller_hash",
    slug: "lucy-roastery",
    created_at: new Date(),
  };

  const demoProduct = {
    id: "prod-fail-1",
    seller_id: demoSeller.id,
    name: "Yirgacheffe Reserve Beans",
    price_santim: 45000, // 450 ETB
    available: true,
    deleted_at: null,
    created_at: new Date(),
  };

  // In-memory simulated PostgreSQL tables
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
      defaultOtp: "123456",
    });
    mockServerUrl = await mockSMSHub.start();

    // 2. Set test environment configuration
    process.env.SMSHUB_API_KEY = "sk_test_qa007_gateway_failure_key";
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

    // 3. Build PrismaService Mock simulating relational queries and transactions
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
              dbOrderItems.push({ id: `item-${Date.now()}-${Math.random()}`, order_id: id, ...item });
            }
          }
          if (data.order_events?.create) {
            const eventData = Array.isArray(data.order_events.create)
              ? data.order_events.create
              : [data.order_events.create];
            for (const ev of eventData) {
              dbOrderEvents.push({ id: `event-${Date.now()}-${Math.random()}`, order_id: id, created_at: new Date(), ...ev });
            }
          }
          if (data.action_tokens?.create) {
            const tokens = Array.isArray(data.action_tokens.create)
              ? data.action_tokens.create
              : [data.action_tokens.create];
            for (const tok of tokens) {
              const record = { id: `token-${Date.now()}-${Math.random()}`, order_id: id, revoked_at: null, created_at: new Date(), ...tok };
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
          const event = { id: `event-${Date.now()}-${Math.random()}`, created_at: new Date(), ...data };
          dbOrderEvents.push(event);
          return { ...event };
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
          const record = { id: `token-${Date.now()}-${Math.random()}`, revoked_at: null, created_at: new Date(), ...data };
          dbActionTokens.set(data.token_hash, record);
          return { ...record };
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
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            created_at: new Date(),
            ...data,
          };
          dbMessages.push(record);
          return { ...record };
        },
        findUnique: async ({ where }: any) => {
          const m = dbMessages.find((msg) => msg.id === where.id);
          return m ? { ...m } : null;
        },
        findMany: async ({ where }: any) => {
          return dbMessages.filter((m) => {
            if (where.OR) {
              const matchesSeller = where.OR.some((clause: any) => {
                if (clause.seller_id && m.seller_id === clause.seller_id) return true;
                if (clause.order && m.order_id) {
                  const ord = dbOrders.get(m.order_id);
                  return ord?.seller_id === clause.order.seller_id;
                }
                return false;
              });
              if (!matchesSeller) return false;
            }
            if (where.order_id && m.order_id !== where.order_id) return false;
            return true;
          });
        },
        update: async ({ where, data }: any) => {
          const m = dbMessages.find((msg) => msg.id === where.id);
          if (m) Object.assign(m, data);
          return m ? { ...m } : null;
        },
      },
      rateCounter: {
        findUnique: async ({ where }: any) => {
          const rc = dbRateCounters.get(where.key || where.phone);
          return rc ? { ...rc } : null;
        },
        upsert: async ({ where, create, update }: any) => {
          const key = where.key || where.phone;
          const existing = dbRateCounters.get(key);
          const data = existing
            ? { ...existing, ...update, count: (existing.count || 0) + (update.count?.increment || 1) }
            : { id: `rc-${Date.now()}`, ...create };
          dbRateCounters.set(key, data);
          return { ...data };
        },
        update: async ({ where, data }: any) => {
          const key = where.key || where.phone;
          const existing = dbRateCounters.get(key);
          if (!existing) return null;
          const updated = {
            ...existing,
            ...data,
            count: (existing.count || 0) + (data.count?.increment || 1),
          };
          dbRateCounters.set(key, updated);
          return { ...updated };
        },
      },
      suppressionList: {
        findUnique: async ({ where }: any) => {
          const s = dbSuppressionList.get(where.phone);
          return s ? { ...s } : null;
        },
      },
      $transaction: async (arg: any) => {
        if (typeof arg === "function") {
          return arg(prismaMock);
        }
        return Promise.all(arg);
      },
    };

    // 4. Override SMSHubService with fast retry delays (5ms, 10ms) for high-performance testing
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(SMSHubService)
      .useFactory({
        factory: () =>
          new SMSHubService({
            baseUrl: mockServerUrl,
            mode: "test",
            apiKey: process.env.SMSHUB_API_KEY,
            retryDelays: [5, 10], // Fast bounded delays for test suite execution
            maxRetries: 3,
            timeoutMs: 80, // Fast 80ms timeout for network timeout test
            minRequestIntervalMs: 0,
          }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    // 5. Generate authentic seller session cookie
    authService = app.get(AuthService);
    const sessionToken = await authService.createSessionToken({ sellerId: demoSeller.id });
    sellerSessionCookie = `${SESSION_COOKIE_NAME}=${sessionToken}`;
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
    mockSMSHub.reset();
  });

  /**
   * Helper: Seeds an order directly into in-memory state.
   */
  function seedOrder(customState: string = "new", customConsent: boolean = true) {
    const orderId = `order-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = 1000 + dbOrders.size + 1;
    const orderRecord = {
      id: orderId,
      number: orderNumber,
      seller_id: demoSeller.id,
      buyer_name: "Tadesse Hailu",
      buyer_phone: "0911223344",
      state: customState,
      sms_consent: customConsent,
      total_santim: 45000,
      item_count: 1,
      created_at: new Date(),
    };
    dbOrders.set(orderId, orderRecord);
    dbOrderItems.push({
      id: `item-${Date.now()}`,
      order_id: orderId,
      product_id: demoProduct.id,
      name: demoProduct.name,
      price_santim: demoProduct.price_santim,
      quantity: 1,
    });
    return orderRecord;
  }

  // =========================================================================
  // Acceptance Criterion 1: 502 retries 3x, then logs row as 'failed' with active resend
  // Acceptance Criterion 2: Order state remains saved in database despite SMS failure
  // =========================================================================
  describe("Acceptance Criteria 1 & 2: 502 Bad Gateway 3x Retries & State Preservation", () => {
    it("502 retries 3x, preserves order state in database, and logs row as 'failed' with active resend", async () => {
      // 1. Seed a new order in DB
      const order = seedOrder("new", true);

      // 2. Configure Mock SMSHub to simulate continuous 502 Bad Gateway on /api/test
      mockSMSHub.simulateBadGateway("/api/test");

      // 3. Seller accepts order via POST /api/orders/:id/accept
      const postRes = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/accept`)
        .set("Cookie", sellerSessionCookie)
        .send();

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.currentState).toBe("accepted");

      // 4. Verify Criterion 2: Order state in database is securely preserved as 'accepted'
      const orderInDb = dbOrders.get(order.id);
      expect(orderInDb).toBeDefined();
      expect(orderInDb.state).toBe("accepted");

      // Verify audit trail event recorded
      const events = dbOrderEvents.filter((e) => e.order_id === order.id);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[events.length - 1].to_state).toBe("accepted");

      // 5. Verify Criterion 1: Gateway retried 3 times (1 initial attempt + 2 retries)
      const requests = mockSMSHub.getRequests().filter((r) => r.path === "/api/test");
      expect(requests.length).toBe(3);

      // 6. Verify Criterion 1: Message row logged as 'failed' with error_type 'provider_error'
      const messages = dbMessages.filter((m) => m.order_id === order.id);
      expect(messages.length).toBe(1);
      const failedMsg = messages[0];
      expect(failedMsg.status).toBe("failed");
      expect(failedMsg.error_type).toBe("provider_error");
      expect(failedMsg.attempts).toBe(1);

      // 7. Verify Message Audit Query (GET /api/messages):
      // Seller sees failed status and resend button is active (status === 'failed')
      const messagesRes = await request(app.getHttpServer())
        .get("/api/messages")
        .set("Cookie", sellerSessionCookie);

      expect(messagesRes.status).toBe(200);
      expect(messagesRes.body.success).toBe(true);
      const messageList = messagesRes.body.data;
      const foundInList = messageList.find((m: any) => m.id === failedMsg.id);
      expect(foundInList).toBeDefined();
      expect(foundInList.status).toBe("failed");
      expect(foundInList.errorType).toBe("provider_error");

      // 8. Gateway recovers: clear simulated errors and execute manual resend (BE-016)
      mockSMSHub.clearSimulatedErrors();

      const resendRes = await request(app.getHttpServer())
        .post(`/api/messages/${failedMsg.id}/resend`)
        .set("Cookie", sellerSessionCookie);

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.success).toBe(true);
      expect(resendRes.body.data.resent).toBe(true);
      expect(resendRes.body.data.message.status).toBe("test_passed");
      expect(resendRes.body.data.message.attempts).toBe(2);

      // Verify database updated
      const updatedMsg = dbMessages.find((m) => m.id === failedMsg.id);
      expect(updatedMsg.status).toBe("test_passed");
      expect(updatedMsg.error_type).toBeNull();
    });

    it("recovers automatically if 502 Bad Gateway is transient and succeeds on retry", async () => {
      // 1. Seed order in 'accepted' state
      const order = seedOrder("accepted", true);

      // 2. Configure transient 502: fails 1 time, then recovers on 2nd attempt
      mockSMSHub.simulateTransientBadGateway("/api/test", 1);

      // 3. Transition order to 'ready' via POST /api/orders/:id/ready
      const postRes = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/ready`)
        .set("Cookie", sellerSessionCookie)
        .send();

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.currentState).toBe("ready");

      // 4. Verify 2 total requests occurred (1 failure + 1 successful retry)
      const requests = mockSMSHub.getRequests().filter((r) => r.path === "/api/test");
      expect(requests.length).toBe(2);

      // 5. Verify message row is logged as 'test_passed' (not failed)
      const readyMsg = dbMessages.find(
        (m) => m.order_id === order.id && m.event === "buyer_order_ready"
      );
      expect(readyMsg).toBeDefined();
      expect(readyMsg.status).toBe("test_passed");

      // 6. Verify 4-digit pickup code was generated and persisted
      const pickupCodeRecord = dbPickupCodes.get(order.id);
      expect(pickupCodeRecord).toBeDefined();
      expect(pickupCodeRecord.code_hash).toBeDefined();
    });
  });

  // =========================================================================
  // 429 Rate Limit Simulation
  // =========================================================================
  describe("429 Rate Limited & Retry-After Handling", () => {
    it("handles 429 rate limit with Retry-After header and fails safely if rate limit persists", async () => {
      const order = seedOrder("new", true);

      // Simulate 429 Rate Limited with Retry-After: 0
      mockSMSHub.simulateRateLimit("/api/test", 0);

      // Transition order to 'rejected' via POST /api/orders/:id/reject
      const postRes = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/reject`)
        .set("Cookie", sellerSessionCookie)
        .send();

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.currentState).toBe("rejected");

      // Order state in DB is preserved as 'rejected'
      const orderInDb = dbOrders.get(order.id);
      expect(orderInDb.state).toBe("rejected");

      // Rate limit was retried 3 times
      const requests = mockSMSHub.getRequests().filter((r) => r.path === "/api/test");
      expect(requests.length).toBe(3);

      // Message logged as 'failed' with error_type 'rate_limited'
      const messages = dbMessages.filter((m) => m.order_id === order.id);
      expect(messages.length).toBe(1);
      expect(messages[0].status).toBe("failed");
      expect(messages[0].error_type).toBe("rate_limited");
    });
  });

  // =========================================================================
  // Buyer Checkout & OTP Verification with Outbound Gateway Failure
  // =========================================================================
  describe("Buyer Order Creation Flow with Gateway Failure", () => {
    it("preserves order creation and items in database even when seller alert SMS encounters 502", async () => {
      const buyerPhone = "0911556677";

      // 1. Buyer initiates checkout draft (OTP send works normally)
      const draftRes = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: demoSeller.slug,
          buyerName: "Almaz Kebede",
          buyerPhone,
          items: [{ productId: demoProduct.id, quantity: 2 }],
          smsConsent: true,
        });

      expect(draftRes.status).toBe(201);
      const draftId = draftRes.body.data.draftId;
      expect(draftId).toBeDefined();

      // 2. Set 502 on /api/test (affecting outbound seller new order notification)
      mockSMSHub.simulateBadGateway("/api/test");

      // 3. Buyer verifies OTP code
      const verifyRes = await request(app.getHttpServer())
        .post("/api/checkout/verify")
        .send({
          draftId,
          code: "123456",
        });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      const orderId = verifyRes.body.data.orderId;
      const orderNumber = verifyRes.body.data.orderNumber;
      expect(orderId).toBeDefined();
      expect(orderNumber).toBeGreaterThan(0);

      // 4. Verify order is safely committed in database with state 'new'
      const savedOrder = dbOrders.get(orderId);
      expect(savedOrder).toBeDefined();
      expect(savedOrder.state).toBe("new");
      expect(savedOrder.buyer_phone).toBe(buyerPhone);

      // Order items are fully preserved
      const items = dbOrderItems.filter((i) => i.order_id === orderId);
      expect(items.length).toBe(1);
      expect(items[0].product_id).toBe(demoProduct.id);
      expect(items[0].quantity).toBe(2);

      // 5. Verify seller alert message is logged as 'failed' in audit log
      const sellerAlert = dbMessages.find((m) => m.order_id === orderId);
      expect(sellerAlert).toBeDefined();
      expect(sellerAlert.status).toBe("failed");
      expect(sellerAlert.error_type).toBe("provider_error");
    });
  });

  // =========================================================================
  // Non-Retryable Carrier Rejections vs Retryable 502
  // =========================================================================
  describe("Carrier Rejections & Invariant Integrity", () => {
    it("does not retry 422 carrier rejection errors and marks message as failed immediately", async () => {
      const order = seedOrder("new", true);

      // Simulate 422 carrier rejection (credit refunded, no retry per docs/05 Sec 4)
      mockSMSHub.simulateCarrierError("/api/test", "carrier_rejected", "Safaricom carrier filter rejected");

      const postRes = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/accept`)
        .set("Cookie", sellerSessionCookie)
        .send();

      expect(postRes.status).toBe(200);
      expect(postRes.body.currentState).toBe("accepted");

      // Only 1 attempt made (no retries on 422)
      const requests = mockSMSHub.getRequests().filter((r) => r.path === "/api/test");
      expect(requests.length).toBe(1);

      const msg = dbMessages.find((m) => m.order_id === order.id);
      expect(msg).toBeDefined();
      expect(msg.status).toBe("failed");
      expect(msg.error_type).toBe("carrier_rejected");
      expect(msg.attempts).toBe(1);
    });
  });

  // =========================================================================
  // Network Timeout & Connection Abort Handling (docs/05 Sec 4, docs/11 Sec 3)
  // =========================================================================
  describe("Network Timeout & Unresponsive Gateway Resilience", () => {
    it("handles connection timeout gracefully, preserves order state in DB, and allows manual resend", async () => {
      const order = seedOrder("new", true);

      // Simulate network timeout: delay 200ms (> client timeoutMs of 80ms)
      mockSMSHub.simulateTimeout("/api/test", 200);

      const postRes = await request(app.getHttpServer())
        .post(`/api/orders/${order.id}/accept`)
        .set("Cookie", sellerSessionCookie)
        .send();

      expect(postRes.status).toBe(200);
      expect(postRes.body.success).toBe(true);
      expect(postRes.body.currentState).toBe("accepted");

      // Verify order state in DB is preserved as 'accepted'
      const orderInDb = dbOrders.get(order.id);
      expect(orderInDb).toBeDefined();
      expect(orderInDb.state).toBe("accepted");

      // Message row is logged as 'failed' with error_type 'timeout'
      const msg = dbMessages.find((m) => m.order_id === order.id);
      expect(msg).toBeDefined();
      expect(msg.status).toBe("failed");
      expect(msg.error_type).toBe("timeout");

      // Resend is active once gateway recovers
      mockSMSHub.clearSimulatedErrors();

      const resendRes = await request(app.getHttpServer())
        .post(`/api/messages/${msg.id}/resend`)
        .set("Cookie", sellerSessionCookie);

      expect(resendRes.status).toBe(200);
      expect(resendRes.body.data.resent).toBe(true);
      expect(resendRes.body.data.message.status).toBe("test_passed");
    });
  });

  // =========================================================================
  // Messages Audit Log & Resend Eligibility Invariants (BE-016, QA-007)
  // =========================================================================
  describe("Messages Audit Log & Resend Button Invariants", () => {
    it("forbids manual resend on already sent or skipped messages (only failed or unknown eligible)", async () => {
      // Create a successful message row in DB
      const sentMsgId = `msg-sent-${Date.now()}`;
      dbMessages.push({
        id: sentMsgId,
        seller_id: demoSeller.id,
        recipient_phone: "0911223344",
        event: "buyer_order_ready",
        text: "Order #1001 is ready for pickup",
        status: "sent",
        attempts: 1,
        created_at: new Date(),
      });

      // Attempting to resend a 'sent' message returns 400 with INVALID_MESSAGE_STATUS
      const resendRes = await request(app.getHttpServer())
        .post(`/api/messages/${sentMsgId}/resend`)
        .set("Cookie", sellerSessionCookie);

      expect(resendRes.status).toBe(400);
      expect(resendRes.body.error.code).toBe("INVALID_MESSAGE_STATUS");
    });

    it("prevents unauthenticated or cross-seller message resend attempts (401 / 403)", async () => {
      const otherSellerMsgId = `msg-other-${Date.now()}`;
      dbMessages.push({
        id: otherSellerMsgId,
        seller_id: "other-seller-id",
        recipient_phone: "0922334455",
        event: "buyer_order_accepted",
        text: "Order #2001 accepted",
        status: "failed",
        attempts: 1,
        created_at: new Date(),
      });

      // 1. Unauthenticated request returns 401
      const unauthRes = await request(app.getHttpServer())
        .post(`/api/messages/${otherSellerMsgId}/resend`);
      expect(unauthRes.status).toBe(401);

      // 2. Cross-seller request returns 403 Forbidden
      const crossRes = await request(app.getHttpServer())
        .post(`/api/messages/${otherSellerMsgId}/resend`)
        .set("Cookie", sellerSessionCookie);
      expect(crossRes.status).toBe(403);
    });
  });
});
