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
import { SESSION_COOKIE_NAME } from "../src/modules/auth/auth.types";
import { AuthService } from "../src/modules/auth/auth.service";

describe("NestJS Products API E2E (BE-006)", () => {
  let app: INestApplication;
  let prismaMock: any;
  let smshubMock: any;
  let authService: AuthService;
  let sellerToken: string;
  let intruderToken: string;

  const seller1 = {
    id: "seller-123",
    business_name: "Habesha Coffee",
    sms_name: "Habesha",
    phone: "0911223344",
    phone_verified_at: new Date(),
    slug: "habesha-coffee",
  };

  const seller2 = {
    id: "seller-456",
    business_name: "Intruder Bakery",
    sms_name: "Intruder",
    phone: "0922334455",
    phone_verified_at: new Date(),
    slug: "intruder-bakery",
  };

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = "test_api_key_for_products_e2e";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      seller: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === seller1.id) return Promise.resolve(seller1);
          if (where.id === seller2.id) return Promise.resolve(seller2);
          return Promise.resolve(null);
        }),
      },
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
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

    authService = app.get(AuthService);
    sellerToken = await authService.createSessionToken({ sellerId: seller1.id });
    intruderToken = await authService.createSessionToken({ sellerId: seller2.id });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("GET /api/products", () => {
    it("returns 401 when no session cookie or token provided", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/products")
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns products list for authenticated seller", async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          seller_id: seller1.id,
          name: "Buna Special",
          price_santim: 4500,
          available: true,
          created_at: new Date("2026-10-18T10:00:00Z"),
          deleted_at: null,
        },
      ]);

      const res = await request(app.getHttpServer())
        .get("/api/products")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe("prod-1");
      expect(res.body.data[0].name).toBe("Buna Special");
      expect(res.body.data[0].priceSantim).toBe(4500);
    });
  });

  describe("POST /api/products", () => {
    it("returns 401 when unauthenticated", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/products")
        .send({ name: "Tea", priceSantim: 2500 })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it("returns 400 when name is missing or empty", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/products")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({ name: "   ", priceSantim: 2500 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 400 when price is non-positive or invalid", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/products")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({ name: "Tea", priceSantim: 0 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("successfully creates product for authenticated seller", async () => {
      prismaMock.product.create.mockResolvedValue({
        id: "prod-new-1",
        seller_id: seller1.id,
        name: "Yirgacheffe Roast",
        price_santim: 85000,
        available: true,
        created_at: new Date("2026-10-18T10:00:00Z"),
        deleted_at: null,
      });

      const res = await request(app.getHttpServer())
        .post("/api/products")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({
          name: "Yirgacheffe Roast",
          priceSantim: 85000,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("prod-new-1");
      expect(res.body.data.name).toBe("Yirgacheffe Roast");
      expect(res.body.data.priceSantim).toBe(85000);
      expect(res.body.data.price_santim).toBe(85000);
    });
  });

  describe("PATCH /api/products/:id", () => {
    const existing = {
      id: "prod-update-1",
      seller_id: seller1.id,
      name: "Sidama Roast",
      price_santim: 60000,
      available: true,
      created_at: new Date("2026-10-18T10:00:00Z"),
      deleted_at: null,
    };

    it("returns 401 when unauthenticated", async () => {
      const res = await request(app.getHttpServer())
        .patch("/api/products/prod-update-1")
        .send({ name: "New Name" })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it("returns 404 when product does not exist", async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .patch("/api/products/non-existent-id")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({ name: "New Name" })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 Forbidden when trying to update another seller's product", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .patch("/api/products/prod-update-1")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${intruderToken}`)
        .send({ name: "Hacked Name" })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 400 when updating with invalid non-positive price", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .patch("/api/products/prod-update-1")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({ priceSantim: -10 })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("successfully updates product when requested by owner", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existing);
      prismaMock.product.update.mockResolvedValue({
        ...existing,
        name: "Sidama Roast Premium",
        available: false,
      });

      const res = await request(app.getHttpServer())
        .patch("/api/products/prod-update-1")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .send({
          name: "Sidama Roast Premium",
          available: false,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Sidama Roast Premium");
      expect(res.body.data.available).toBe(false);
    });
  });

  describe("DELETE /api/products/:id", () => {
    const existing = {
      id: "prod-del-1",
      seller_id: seller1.id,
      name: "To Delete",
      price_santim: 1000,
      available: true,
      created_at: new Date("2026-10-18T10:00:00Z"),
      deleted_at: null,
    };

    it("returns 401 when unauthenticated", async () => {
      const res = await request(app.getHttpServer())
        .delete("/api/products/prod-del-1")
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it("returns 404 when product not found or already deleted", async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .delete("/api/products/non-existent")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 403 Forbidden when trying to delete another seller's product", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existing);

      const res = await request(app.getHttpServer())
        .delete("/api/products/prod-del-1")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${intruderToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("successfully soft-deletes product when requested by owner", async () => {
      prismaMock.product.findUnique.mockResolvedValue(existing);
      prismaMock.product.update.mockResolvedValue({
        ...existing,
        deleted_at: new Date("2026-10-18T12:00:00Z"),
      });

      const res = await request(app.getHttpServer())
        .delete("/api/products/prod-del-1")
        .set("Cookie", `${SESSION_COOKIE_NAME}=${sellerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);
      expect(res.body.data.id).toBe("prod-del-1");
    });
  });
});
