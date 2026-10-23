import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import helmet from "helmet";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";

/**
 * PR-015 Acceptance Test: HTTP Security Headers (Issue #134)
 *
 * Validates that responses from the NestJS API include standard security headers
 * added by helmet(), such as X-Content-Type-Options and X-Frame-Options.
 */
describe("HTTP Security Headers via Helmet (PR-015, Issue #134)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.SMSHUB_API_KEY = process.env.SMSHUB_API_KEY || "test_api_key_for_helmet_e2e";
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = process.env.PICKUP_CODE_SECRET || "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    const prismaMock = {
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
    // Apply helmet exactly as main.ts does (PR-015)
    app.use(helmet());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /api/health includes X-Content-Type-Options: nosniff (Acceptance Criterion)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("GET /api/health includes X-Frame-Options header", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);

    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("GET /api/health includes X-XSS-Protection or Content-Security-Policy header", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/health")
      .expect(200);

    // Helmet provides at least one of these (depends on version)
    const hasXssProtection = "x-xss-protection" in res.headers;
    const hasCSP = "content-security-policy" in res.headers;
    expect(hasXssProtection || hasCSP).toBe(true);
  });
});
