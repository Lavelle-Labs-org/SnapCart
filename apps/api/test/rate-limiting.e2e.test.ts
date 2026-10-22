import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";
import { SMSHubService } from "../src/modules/smshub/smshub.service";

describe("Rate Limiting E2E (PR-005, Issue #124)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;
  const rateLimitStore = new Map<string, any>();

  const testSeller = {
    id: "seller-rate-limit-1",
    business_name: "Addis Roasters",
    sms_name: "AddisRoast",
    phone: "0911000001",
    phone_verified_at: new Date(),
    password_hash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
    slug: "addis-roasters",
  };

  const testProduct = {
    id: "prod-rate-limit-1",
    seller_id: testSeller.id,
    name: "Sidama Beans 500g",
    price_santim: 35000,
    available: true,
    deleted_at: null,
  };

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_rate_limit_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.slug === testSeller.slug || where.id === testSeller.id || where.phone === testSeller.phone) {
            return Promise.resolve(testSeller);
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: "seller-new-1",
            phone_verified_at: null,
            ...data,
          })
        ),
      },
      product: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve([testProduct]);
        }),
      },
      phoneVerification: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: `pv-${Date.now()}-${Math.random()}`,
            created_at: new Date(),
            ...data,
          })
        ),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      rateCounter: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          return Promise.resolve(rateLimitStore.get(where.key) ?? null);
        }),
        upsert: vi.fn().mockImplementation(({ where, create, update }) => {
          const existing = rateLimitStore.get(where.key);
          const record = existing
            ? { ...existing, ...update }
            : { key: where.key, ...create };
          rateLimitStore.set(where.key, record);
          return Promise.resolve(record);
        }),
        update: vi.fn().mockImplementation(({ where, data }) => {
          const existing = rateLimitStore.get(where.key);
          const newCount =
            data.count && data.count.increment !== undefined
              ? (existing?.count ?? 0) + data.count.increment
              : (data.count ?? 1);
          const record = { ...existing, count: newCount };
          rateLimitStore.set(where.key, record);
          return Promise.resolve(record);
        }),
      },
    };

    smshubMock = {
      verifySend: vi.fn().mockResolvedValue({
        status: "success",
        data: { verification_id: "verif-123456" },
      }),
      sendSMS: vi.fn().mockResolvedValue({
        status: "success",
        data: { message_id: "msg-123", would_send: false },
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

  beforeEach(() => {
    rateLimitStore.clear();
    vi.clearAllMocks();
  });

  it("enforces max 5 checkout attempts per phone/hr returning 429 and Retry-After", async () => {
    const phone = "0912345678";
    const checkoutPayload = {
      slug: testSeller.slug,
      buyerName: "Abebe Kebede",
      buyerPhone: phone,
      items: [{ productId: testProduct.id, quantity: 1 }],
    };

    // First 5 attempts with unique IPs should be permitted
    for (let i = 1; i <= 5; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .set("X-Forwarded-For", `10.0.0.${i}`)
        .send(checkoutPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    }

    // 6th attempt with same phone must be rejected with 429
    const breachRes = await request(app.getHttpServer())
      .post("/api/checkout")
      .set("X-Forwarded-For", "10.0.0.99")
      .send(checkoutPayload);

    expect(breachRes.status).toBe(429);
    expect(breachRes.body.success).toBe(false);
    expect(breachRes.body.error.code).toBe("RATE_LIMITED");
    expect(breachRes.body.error.retryAfter).toBeGreaterThan(0);
    expect(breachRes.headers["retry-after"]).toBeDefined();
    expect(Number(breachRes.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("enforces max 10 checkout attempts per IP/hr returning 429", async () => {
    const ip = "192.168.1.50";

    // 10 checkout attempts from same IP with different phones should succeed
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/checkout")
        .set("X-Forwarded-For", ip)
        .send({
          slug: testSeller.slug,
          buyerName: `Buyer ${i}`,
          buyerPhone: `09200000${i.toString().padStart(2, "0")}`,
          items: [{ productId: testProduct.id, quantity: 1 }],
        });

      expect(res.status).toBe(201);
    }

    // 11th attempt from same IP must be rate limited
    const breachRes = await request(app.getHttpServer())
      .post("/api/checkout")
      .set("X-Forwarded-For", ip)
      .send({
        slug: testSeller.slug,
        buyerName: "Buyer 11",
        buyerPhone: "0920000099",
        items: [{ productId: testProduct.id, quantity: 1 }],
      });

    expect(breachRes.status).toBe(429);
    expect(breachRes.body.success).toBe(false);
    expect(breachRes.body.error.code).toBe("RATE_LIMITED");
    expect(breachRes.headers["retry-after"]).toBeDefined();
  });

  it("enforces max 10 login attempts per IP/hr returning 429", async () => {
    const ip = "192.168.2.100";

    // 10 failed login attempts from same IP
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({
          phone: "0911000001",
          password: "wrong_password",
        });

      // 401 Unauthorized for bad password
      expect(res.status).toBe(401);
    }

    // 11th attempt must be rejected with 429
    const breachRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .set("X-Forwarded-For", ip)
      .send({
        phone: "0911000001",
        password: "wrong_password",
      });

    expect(breachRes.status).toBe(429);
    expect(breachRes.body.success).toBe(false);
    expect(breachRes.body.error.code).toBe("RATE_LIMITED");
    expect(breachRes.headers["retry-after"]).toBeDefined();
  });

  it("enforces max 5 signup attempts per phone/hr returning 429", async () => {
    const signupPhone = "0944000001";
    const baseSignup = {
      business_name: "Test Shop",
      sms_name: "TestShop",
      phone: signupPhone,
      password: "Password123!",
    };

    // First 5 attempts from different IPs
    for (let i = 1; i <= 5; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .set("X-Forwarded-For", `172.16.0.${i}`)
        .send(baseSignup);

      expect(res.status).toBe(201);
    }

    // 6th attempt with same phone must be rate-limited
    const breachRes = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .set("X-Forwarded-For", "172.16.0.99")
      .send(baseSignup);

    expect(breachRes.status).toBe(429);
    expect(breachRes.body.success).toBe(false);
    expect(breachRes.body.error.code).toBe("RATE_LIMITED");
    expect(breachRes.headers["retry-after"]).toBeDefined();
  });

  it("enforces max 10 signup attempts per IP/hr returning 429", async () => {
    const ip = "172.16.1.100";

    // 10 attempts from same IP with different phones
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .set("X-Forwarded-For", ip)
        .send({
          business_name: `Shop ${i}`,
          sms_name: `Shop${i}`,
          phone: `09450000${i.toString().padStart(2, "0")}`,
          password: "Password123!",
        });

      expect(res.status).toBe(201);
    }

    // 11th attempt from same IP must be rate-limited
    const breachRes = await request(app.getHttpServer())
      .post("/api/auth/signup")
      .set("X-Forwarded-For", ip)
      .send({
        business_name: "Shop 11",
        sms_name: "Shop11",
        phone: "0945000099",
        password: "Password123!",
      });

    expect(breachRes.status).toBe(429);
    expect(breachRes.body.success).toBe(false);
    expect(breachRes.body.error.code).toBe("RATE_LIMITED");
    expect(breachRes.headers["retry-after"]).toBeDefined();
  });
});
