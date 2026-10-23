import { describe, it, expect, beforeEach, vi } from "vitest";
import { HttpException, HttpStatus } from "@nestjs/common";
import { HealthController } from "../health.controller";
import { HealthService } from "../health.service";
import { PrismaService } from "../../../prisma/prisma.service";

describe("HealthController & HealthService (PR-013, Issue #132)", () => {
  let healthController: HealthController;
  let healthService: HealthService;
  let prismaMock: { $queryRaw: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prismaMock = {
      $queryRaw: vi.fn(),
    };
    healthService = new HealthService(prismaMock as unknown as PrismaService);
    healthController = new HealthController(healthService);
  });

  it("returns health status with ok and database connected when ping succeeds", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ 1: 1 }]);

    const result = await healthController.getHealth();
    expect(result.status).toBe("ok");
    expect(result.app).toBe("order-by-sms-api");
    expect(result.database).toBe("connected");
    expect(typeof result.timestamp).toBe("string");
    expect(typeof result.uptime).toBe("number");
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("throws 503 Service Unavailable when database ping query fails", async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error("Database connection refused"));

    await expect(healthController.getHealth()).rejects.toThrow(HttpException);

    try {
      await healthController.getHealth();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const response = httpErr.getResponse() as Record<string, any>;
      expect(response.status).toBe("down");
      expect(response.code).toBe("SERVICE_UNAVAILABLE");
      expect(response.database).toBe("disconnected");
    }
  });
});
