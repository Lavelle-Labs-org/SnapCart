import { Injectable } from "@nestjs/common";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  app: string;
  environment: string;
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService {
  getHealth(): HealthStatus {
    return {
      status: "ok",
      app: "order-by-sms-api",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
