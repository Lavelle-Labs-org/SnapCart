import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import crypto from "crypto";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Webhook Route Alignment (PR-004, Issue #123)", () => {
  let app: INestApplication;
  let prismaMock: any;
  const WEBHOOK_SECRET = "test_webhook_route_alignment_secret";

  beforeAll(async () => {
    process.env.SMSHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SMSHUB_API_KEY = "test_api_key_route_alignment";
    process.env.SESSION_SECRET = "mock_session_secret_at_least_32_characters_long";
    process.env.PICKUP_CODE_SECRET = "mock_pickup_code_secret_32_characters_long";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/order_by_sms";

    prismaMock = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
      messageEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      message: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    // Use the exact configuration required for PR-004
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
    vi.clearAllMocks();
  });

  function generateSignature(bodyStr: string, timestamp: number, secret: string = WEBHOOK_SECRET): string {
    const data = `${timestamp}.${bodyStr}`;
    const hash = crypto.createHmac("sha256", secret).update(data).digest("hex");
    return `t=${timestamp},v1=${hash}`;
  }

  it("POST /webhooks/smshub reaches webhook controller and returns 200 with valid signature", async () => {
    prismaMock.messageEvent.findUnique.mockResolvedValue(null);
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg-route-1" });
    prismaMock.message.update.mockResolvedValue({});
    prismaMock.messageEvent.create.mockResolvedValue({});

    const bodyObj = {
      event: "message.sent",
      data: { message_id: "smshub_aligned_001", status: "sent" },
    };
    const bodyStr = JSON.stringify(bodyObj);
    const now = Math.floor(Date.now() / 1000);
    const signature = generateSignature(bodyStr, now);

    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .set("X-SMSHub-Signature", signature)
      .set("X-SMSHub-Event", "message.sent")
      .set("X-SMSHub-Delivery", "deliv-route-aligned-1")
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.received).toBe(true);
    expect(res.body.data.event).toBe("message.sent");
  });

  it("POST /webhooks/smshub rejects missing signature with 400 (not 404)", async () => {
    const res = await request(app.getHttpServer())
      .post("/webhooks/smshub")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ event: "ping" }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_SIGNATURE");
  });
});
