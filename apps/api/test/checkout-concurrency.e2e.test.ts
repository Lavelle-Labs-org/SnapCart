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
import { CheckoutService } from "../src/modules/checkout/checkout.service";

describe("Checkout Concurrency Integration (PR-008, Issue #127)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;

  const testSeller = {
    id: "seller-concurrent-1",
    business_name: "Bole Artisan Bakery",
    sms_name: "BoleArtisan",
    phone: "0911554433",
    phone_verified_at: new Date(),
    slug: "bole-bakery",
  };

  const testProduct = {
    id: "prod-concurrent-1",
    seller_id: testSeller.id,
    name: "Sourdough Loaf",
    price_santim: 25000,
    available: true,
    deleted_at: null,
  };

  // In-memory orders map: orderNumber -> Order record
  const orders = new Map<number, any>();
  const drafts = new Map<string, any>();

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_concurrent_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.slug === testSeller.slug || where.id === testSeller.id) {
            return Promise.resolve(testSeller);
          }
          return Promise.resolve(null);
        }),
      },
      product: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          const ids: string[] = where.id?.in || [];
          if (ids.includes(testProduct.id) && where.seller_id === testSeller.id) {
            return Promise.resolve([testProduct]);
          }
          return Promise.resolve([]);
        }),
      },
      phoneVerification: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve(drafts.get(where.id) || null);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const existing = drafts.get(where.id);
          if (existing) {
            Object.assign(existing, data);
          }
          return Promise.resolve(existing);
        }),
      },
      order: {
        findFirst: vi.fn().mockImplementation(async ({ where }) => {
          // Simulate real database I/O delay across concurrent connections
          await new Promise((r) => setTimeout(r, 15));
          const sellerOrders = Array.from(orders.values()).filter(
            (o) => o.seller_id === where.seller_id
          );
          if (sellerOrders.length === 0) return null;
          sellerOrders.sort((a, b) => b.number - a.number);
          return { number: sellerOrders[0].number };
        }),
        create: vi.fn().mockImplementation(async ({ data }) => {
          // Simulate database write latency
          await new Promise((r) => setTimeout(r, 10));

          // Simulate Prisma @@unique([seller_id, number]) constraint violation
          const sellerOrders = Array.from(orders.values()).filter(
            (o) => o.seller_id === data.seller_id
          );
          if (sellerOrders.some((o) => o.number === data.number)) {
            const p2002Error: any = new Error(
              `Unique constraint failed on the fields: (\`seller_id\`, \`number\`)`
            );
            p2002Error.code = "P2002";
            throw p2002Error;
          }

          const orderRecord = {
            id: `ord-concurrent-${data.number}`,
            created_at: new Date(),
            ...data,
            order_items: data.order_items?.create || [],
          };
          orders.set(data.number, orderRecord);
          return orderRecord;
        }),
      },
      message: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `msg-concurrent-${Date.now()}`, ...data })
        ),
      },
      suppressionList: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => {
        return cb(prismaMock);
      }),
    };

    smshubMock = {
      verifyCheck: vi.fn().mockResolvedValue({
        status: "success",
        data: {
          valid: true,
          verification_status: "approved",
        },
      }),
      sendSMS: vi.fn().mockResolvedValue({
        status: "success",
        data: { message_id: "smshub-msg-concurrent", would_send: false },
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
    app.setGlobalPrefix("api", {
      exclude: ["webhooks/smshub", "webhooks/(.*)"],
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("simulates 5 simultaneous checkouts for the same seller and completes with 5 sequential order numbers without P2002 errors", async () => {
    orders.clear();
    drafts.clear();

    // Setup 5 pending verification drafts for 5 different concurrent buyers
    for (let i = 1; i <= 5; i++) {
      const draftId = `draft-concurrent-${i}`;
      const buyerPhone = `091100000${i}`;
      drafts.set(draftId, {
        id: draftId,
        phone: buyerPhone,
        purpose: "buyer_checkout",
        status: "pending",
        verification_id: `ver-hub-concurrent-${i}`,
        expires_at: new Date(Date.now() + 300 * 1000),
        draft: JSON.stringify({
          sellerId: testSeller.id,
          slug: testSeller.slug,
          buyerName: `Buyer ${i}`,
          buyerPhone,
          smsConsent: true,
          consentWording: "Send me updates",
          totalSantim: 25000,
          items: [
            {
              productId: testProduct.id,
              name: testProduct.name,
              unitPriceSantim: 25000,
              quantity: 1,
            },
          ],
        }),
      });
    }

    const checkoutService = app.get<CheckoutService>(CheckoutService);

    // Fire all 5 requests simultaneously using Promise.all
    const responses = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        checkoutService.verifyCheckout({
          draftId: `draft-concurrent-${i}`,
          code: "123456",
        })
      )
    );

    // Verify all 5 checkouts succeeded and have orderNumber
    for (const res of responses) {
      expect(res.orderNumber).toBeDefined();
    }

    // Extract all generated order numbers
    const generatedOrderNumbers = responses
      .map((r) => r.orderNumber)
      .sort((a, b) => a - b);

    // Verify 5 distinct sequential order numbers: 1001, 1002, 1003, 1004, 1005
    expect(generatedOrderNumbers).toEqual([1001, 1002, 1003, 1004, 1005]);
  });
});
