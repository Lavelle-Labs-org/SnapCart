import { Controller, Get, Inject } from "@nestjs/common";
import { HealthService } from "./health.service";
import type { HealthStatus } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService
  ) {}

  @Get()
  async getHealth(): Promise<HealthStatus> {
    return await this.healthService.getHealth();
  }
}
