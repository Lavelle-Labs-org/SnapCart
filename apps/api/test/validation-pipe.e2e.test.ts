import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SMSHubService } from "../src/modules/smshub/smshub.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { SESSION_COOKIE_NAME } from "../src/modules/auth/auth.types";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("NestJS Global Validation Pipe with Whitelist E2E (PR-017, Issue #136)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;
  let authService: AuthService;
  let sellerToken: string;

  const mockSeller = {
    id: "seller-whitelist-test-1",
    business_name: "Habesha Test Shop",
    sms_name: "HabeshaTest",
    phone: "0911000001",
    slug: "habesha-test",
    password_hash: "mock_hash",
    phone_verified_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_whitelist";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn().mockResolvedValue(mockSeller),
        create: vi.fn(),
        update: vi.fn(),
      },
      product: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      phoneVerification: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    smshubMock = {
      verifySend: vi.fn().mockResolvedValue({
        status: "success",
        data: { verification_id: "ver_whitelist_1", expires_in: 300 },
      }),
      verifyCheck: vi.fn(),
      sendSMS: vi.fn(),
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

    authService = app.get(AuthService);
    sellerToken = await authService.createSessionToken({ sellerId: mockSeller.id });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("POST /api/auth/signup", () => {
    it("strips unexpected unwhitelisted properties before reaching controller", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(null);
      prismaMock.seller.create.mockImplementation(({ data }: any) => {
        // Assert that the database create payload received from service does NOT have unwhitelisted fields
        expect(data.injectedRole).toBeUndefined();
        expect(data.hackedProperty).toBeUndefined();
        return Promise.resolve({
          id: "seller-new-1",
          business_name: data.business_name,
          sms_name: data.sms_name,
          phone: data.phone,
          slug: "habesha-coffee",
          phone_verified_at: null,
          created_at: new Date(),
        });
      });

      const res = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .send({
          business_name: "Habesha Coffee",
          sms_name: "Habesha",
          phone: "0911223344",
          password: "password12345",
          injectedRole: "admin",
          hackedProperty: { should: "be_stripped" },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.seller_id).toBe("seller-new-1");
    });

    it("returns 400 VALIDATION_ERROR when required fields are missing", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/auth/signup")
        .send({
          phone: "0911223344",
          // missing business_name, sms_name, password
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/products", () => {
    it("strips unwhitelisted properties from product creation payload", async () => {
      prismaMock.seller.findUnique.mockResolvedValue(mockSeller);
      prismaMock.product.create.mockImplementation(({ data }: any) => {
        expect(data.extraEvilField).toBeUndefined();
        expect(data.isAdmin).toBeUndefined();
        return Promise.resolve({
          id: "prod-whitelist-1",
          seller_id: mockSeller.id,
          name: data.name,
          price_santim: data.price_santim,
          available: true,
          created_at: new Date(),
          deleted_at: null,
        });
      });

      const res = await request(app.getHttpServer())
        .post("/api/products")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({
          name: "Organic Coffee",
          priceBirr: 120,
          extraEvilField: "malicious_injection",
          isAdmin: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Organic Coffee");
      expect(res.body.data.priceSantim).toBe(12000);
      expect((res.body.data as any).extraEvilField).toBeUndefined();
    });
  });
});
