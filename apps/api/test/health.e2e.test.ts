import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

describe("NestJS Health API E2E (GET /api/health)", () => {
  let app: INestApplication;
  let prismaMock: { $connect: any; $disconnect: any; $queryRaw: any };

  beforeAll(async () => {
    // Ensure test environment variables are set
    process.env.SMSHUB_API_KEY = process.env.SMSHUB_API_KEY || "test_api_key_for_health_e2e";
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = process.env.PICKUP_CODE_SECRET || "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
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
    if (app) {
      await app.close();
    }
  });

  it("GET /api/health returns 200 with standard JSON envelope and health status when DB is connected", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.app).toBe("snapcart-api");
    expect(res.body.data.database).toBe("connected");
    expect(typeof res.body.data.timestamp).toBe("string");
    expect(typeof res.body.data.uptime).toBe("number");
  });

  it("GET /api/health returns 503 if PostgreSQL is disconnected (Acceptance Criterion)", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("Connection refused: 5432"));

    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(503);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.message).toBe("Database ping failed");
    expect(res.body.error.status).toBe("down");
    expect(res.body.error.database).toBe("disconnected");
    expect(res.body.error.error).toBe("Connection refused: 5432");
  });

  it("GET /api/unknown-endpoint returns 404 with standard error JSON envelope", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/unknown-endpoint")
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.message).toContain("Cannot GET /api/unknown-endpoint");
  });
});
