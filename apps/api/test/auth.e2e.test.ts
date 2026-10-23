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
import { hashPassword } from "../src/modules/auth/password";
import { SESSION_COOKIE_NAME } from "../src/modules/auth/auth.types";

describe("NestJS Seller Auth API E2E (MIG-006)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_auth_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      phoneVerification: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    smshubMock = {
      verifySend: vi.fn(),
      verifyCheck: vi.fn(),
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

  describe("POST /api/auth/signup", () => {
    it("successfully creates unverified seller and sends verification code", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(null);
      smshubMock.verifySend.mockResolvedValue({
        status: "success",
        data: { verification_id: "ver_test_e2e_1", expires_in: 300 },
      });
      prismaMock.seller.create.mockResolvedValue({
        id: "seller-e2e-1",
        phone: "0911223344",
        slug: "habesha-e2e",
      });
      prismaMock.phoneVerification.create.mockResolvedValue({});

      const res = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .send({
          business_name: "Habesha E2E",
          sms_name: "Habesha",
          phone: "+251911223344",
          password: "password12345",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.seller_id).toBe("seller-e2e-1");
      expect(res.body.data.verification_id).toBe("ver_test_e2e_1");
    });
  });

  describe("POST /api/auth/verify-phone", () => {
    it("verifies code and sets session cookie", async () => {
      prismaMock.phoneVerification.findFirst.mockResolvedValue({
        id: "pv-e2e-1",
        verification_id: "ver_test_e2e_1",
        phone: "0911223344",
        status: "pending",
      });
      smshubMock.verifyCheck.mockResolvedValue({
        status: "success",
        data: { valid: true, verification_status: "approved" },
      });
      prismaMock.phoneVerification.update.mockResolvedValue({});
      prismaMock.seller.update.mockResolvedValue({
        id: "seller-e2e-1",
        business_name: "Habesha E2E",
        phone: "0911223344",
        slug: "habesha-e2e",
        phone_verified_at: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post("/api/auth/verify-phone")
        .send({
          phone: "0911223344",
          code: "123456",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.seller.id).toBe("seller-e2e-1");

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(SESSION_COOKIE_NAME);
      expect(cookies[0]).toContain("HttpOnly");
      expect(cookies[0].toLowerCase()).toContain("samesite=lax");
    });
  });

  describe("POST /api/auth/login", () => {
    it("authenticates and returns session cookie", async () => {
      const passwordHash = await hashPassword("password12345");
      prismaMock.seller.findUnique.mockResolvedValue({
        id: "seller-e2e-1",
        business_name: "Habesha E2E",
        phone: "0911223344",
        slug: "habesha-e2e",
        password_hash: passwordHash,
        phone_verified_at: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          phone: "0911223344",
          password: "password12345",
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.seller.id).toBe("seller-e2e-1");

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(SESSION_COOKIE_NAME);
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns 401 when session cookie is missing", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/auth/me")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns current seller profile when session cookie is provided", async () => {
      const passwordHash = await hashPassword("password12345");
      const sellerRecord = {
        id: "seller-e2e-1",
        business_name: "Habesha E2E",
        sms_name: "Habesha",
        phone: "0911223344",
        slug: "habesha-e2e",
        password_hash: passwordHash,
        phone_verified_at: new Date(),
        created_at: new Date(),
      };
      prismaMock.seller.findUnique.mockResolvedValue(sellerRecord);

      // Login to get session cookie
      const loginRes = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({
          phone: "0911223344",
          password: "password12345",
        })
        .expect(201);

      const cookieHeader = loginRes.headers["set-cookie"];

      const meRes = await request(app.getHttpServer())
        .get("/api/auth/me")
        .set("Cookie", cookieHeader)
        .expect(200);

      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.seller.id).toBe("seller-e2e-1");
      expect(meRes.body.data.seller.businessName).toBe("Habesha E2E");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears the session cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/logout")
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe("Logged out successfully");

      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain(SESSION_COOKIE_NAME);
      expect(cookies[0]).toContain("Max-Age=0");
    });
  });
});
