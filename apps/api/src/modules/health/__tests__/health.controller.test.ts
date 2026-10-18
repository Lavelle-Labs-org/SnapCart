import { describe, it, expect, beforeEach } from "vitest";
import { HealthController } from "../health.controller";
import { HealthService } from "../health.service";

describe("HealthController & HealthService (MIG-002)", () => {
  let healthController: HealthController;
  let healthService: HealthService;

  beforeEach(() => {
    healthService = new HealthService();
    healthController = new HealthController(healthService);
  });

  it("returns health status with ok and app name", () => {
    const result = healthController.getHealth();
    expect(result.status).toBe("ok");
    expect(result.app).toBe("order-by-sms-api");
    expect(typeof result.timestamp).toBe("string");
    expect(typeof result.uptime).toBe("number");
  });
});
