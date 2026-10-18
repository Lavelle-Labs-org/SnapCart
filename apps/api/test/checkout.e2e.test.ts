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

describe("NestJS Guest Checkout & OTP Dispatch API E2E (BE-008)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;

  const demoSeller = {
    id: "seller-e2e-1",
    business_name: "Habesha Fresh Roasts",
    sms_name: "Habesha",
    phone: "0911223344",
    phone_verified_at: new Date(),
    slug: "habesha-roasts",
  };

  const demoProducts = [
    {
      id: "prod-e2e-1",
      seller_id: demoSeller.id,
      name: "Yirgacheffe Single Origin",
      price_santim: 40000,
      available: true,
      deleted_at: null,
    },
    {
      id: "prod-e2e-2",
      seller_id: demoSeller.id,
      name: "Traditional Clay Pot",
      price_santim: 15000,
      available: true,
      deleted_at: null,
    },
  ];

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_checkout_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.slug === demoSeller.slug || where.id === demoSeller.id) {
            return Promise.resolve(demoSeller);
          }
          return Promise.resolve(null);
        }),
      },
      product: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          const ids: string[] = where.id?.in || [];
          const found = demoProducts.filter(
            (p) => ids.includes(p.id) && p.seller_id === where.seller_id && p.available
          );
          return Promise.resolve(found);
        }),
      },
      phoneVerification: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "draft-e2e-123",
            created_at: new Date(),
            ...data,
          })
        ),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "draft-e2e-123",
            ...data,
          })
        ),
      },
      order: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      suppressionList: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      message: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: "msg-e2e-1", ...data })
        ),
      },
      $transaction: vi.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };

    smshubMock = {
      verifySend: vi.fn(),
      verifyCheck: vi.fn(),
      sendSMS: vi.fn().mockResolvedValue({
        status: "success",
        data: { message_id: "msg-hub-seller-1", credits_used: 1 },
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("POST /api/checkout", () => {
    it("returns 400 when phone number is invalid or international", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: "habesha-roasts",
          buyerName: "Almaz",
          buyerPhone: "+447911123456", // UK international number
          items: [{ productId: "prod-e2e-1", quantity: 1 }],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 when seller slug is unknown", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: "non-existent-shop",
          buyerName: "Almaz",
          buyerPhone: "0911223344",
          items: [{ productId: "prod-e2e-1", quantity: 1 }],
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 400 when items array is empty", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: "habesha-roasts",
          buyerName: "Almaz",
          buyerPhone: "0911223344",
          items: [],
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it("successfully creates verification draft, stores cart details, and returns draftId", async () => {
      smshubMock.verifySend.mockResolvedValue({
        status: "success",
        data: {
          verification_id: "ver-hub-e2e-999",
          expires_in: 300,
        },
      });

      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .send({
          slug: "habesha-roasts",
          buyerName: "Almaz Ayele",
          buyerPhone: "+251911223344",
          smsConsent: true,
          consentWording: "Send me SMS updates about this order",
          items: [
            { productId: "prod-e2e-1", quantity: 2 },
            { productId: "prod-e2e-2", quantity: 1 },
          ],
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.draftId).toBe("draft-e2e-123");
      expect(res.body.data.phone).toBe("0911223344");
      expect(res.body.data.expiresAt).toBeDefined();

      expect(smshubMock.verifySend).toHaveBeenCalledWith(
        "0911223344",
        "Habesha",
        6,
        300
      );
    });
  });

  describe("POST /api/checkout/resend", () => {
    it("returns 404 if draftId does not exist", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post("/api/checkout/resend")
        .send({ draftId: "unknown-draft" })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 429 when cooldown is active (< 60s since last_sent_at)", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-e2e-123",
        phone: "0911223344",
        purpose: "buyer_checkout",
        status: "pending",
        last_sent_at: new Date(Date.now() - 20 * 1000), // 20s ago
        draft: JSON.stringify({ slug: "habesha-roasts" }),
      });

      const res = await request(app.getHttpServer())
        .post("/api/checkout/resend")
        .send({ draftId: "draft-e2e-123" })
        .expect(429);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("RATE_LIMITED");
    });

    it("successfully resends OTP when cooldown has elapsed (>= 60s)", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-e2e-123",
        phone: "0911223344",
        purpose: "buyer_checkout",
        status: "pending",
        last_sent_at: new Date(Date.now() - 65 * 1000), // 65s ago
        draft: JSON.stringify({ slug: "habesha-roasts", sellerId: demoSeller.id }),
      });

      smshubMock.verifySend.mockResolvedValue({
        status: "success",
        data: {
          verification_id: "ver-hub-resend-new",
          expires_in: 300,
        },
      });

      const res = await request(app.getHttpServer())
        .post("/api/checkout/resend")
        .send({ draftId: "draft-e2e-123" })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sent).toBe(true);
      expect(res.body.data.retryAfter).toBe(60);
    });
  });

  describe("POST /api/checkout/verify", () => {
    it("returns 400 when code is invalid or rejected by SMSHub", async () => {
      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-e2e-123",
        phone: "0911223344",
        purpose: "buyer_checkout",
        status: "pending",
        verification_id: "ver-hub-e2e-999",
        expires_at: new Date(Date.now() + 300 * 1000),
        draft: JSON.stringify({ slug: "habesha-roasts", sellerId: demoSeller.id, items: [] }),
      });

      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: {
          valid: false,
          verification_status: "failed",
        },
      });

      const res = await request(app.getHttpServer())
        .post("/api/checkout/verify")
        .send({ draftId: "draft-e2e-123", code: "000000" })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_CODE");
    });

    it("successfully validates OTP, creates order atomically, generates action token, and texts seller", async () => {
      const draftPayload = {
        sellerId: demoSeller.id,
        slug: demoSeller.slug,
        buyerName: "Almaz Ayele",
        buyerPhone: "0911223344",
        smsConsent: true,
        consentWording: "Send me SMS updates about this order",
        totalSantim: 95000,
        items: [
          {
            productId: "prod-e2e-1",
            name: "Yirgacheffe Single Origin",
            unitPriceSantim: 40000,
            quantity: 2,
          },
          {
            productId: "prod-e2e-2",
            name: "Traditional Clay Pot",
            unitPriceSantim: 15000,
            quantity: 1,
          },
        ],
      };

      prismaMock.phoneVerification.findUnique.mockResolvedValue({
        id: "draft-e2e-123",
        phone: "0911223344",
        purpose: "buyer_checkout",
        status: "pending",
        verification_id: "ver-hub-e2e-999",
        expires_at: new Date(Date.now() + 300 * 1000),
        draft: JSON.stringify(draftPayload),
      });

      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: {
          valid: true,
          verification_status: "approved",
        },
      });

      prismaMock.order.findFirst.mockResolvedValue({ number: 1042 });
      prismaMock.order.create.mockResolvedValue({
        id: "ord-e2e-999",
        seller_id: demoSeller.id,
        number: 1043,
        buyer_name: "Almaz Ayele",
        buyer_phone: "0911223344",
        sms_consent: true,
        consent_wording: "Send me SMS updates about this order",
        consent_at: new Date(),
        state: "new",
        total_santim: 95000,
        created_at: new Date(),
        order_items: [
          {
            id: "item-e2e-1",
            order_id: "ord-e2e-999",
            product_id: "prod-e2e-1",
            name_at_order: "Yirgacheffe Single Origin",
            unit_price_santim: 40000,
            quantity: 2,
          },
        ],
      });

      const res = await request(app.getHttpServer())
        .post("/api/checkout/verify")
        .send({
          draftId: "draft-e2e-123",
          code: "482190",
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBe(1043);
      expect(res.body.data.orderId).toBe("ord-e2e-999");
      expect(res.body.data.order.number).toBe(1043);
      expect(res.body.data.order.state).toBe("new");

      // Verify SMS was sent to the seller with action link
      expect(smshubMock.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          msisdn: demoSeller.phone,
          text: expect.stringContaining("New order #1043"),
        })
      );
    });
  });
});
