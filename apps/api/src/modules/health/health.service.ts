import { Injectable, Inject, HttpException, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  app: string;
  environment: string;
  timestamp: string;
  uptime: number;
  database: "connected" | "disconnected";
  code?: string;
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  async getHealth(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        app: "snapcart-api",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: "connected",
      };
    } catch (err: any) {
      throw new HttpException(
        {
          status: "down",
          code: "SERVICE_UNAVAILABLE",
          message: "Database ping failed",
          app: "snapcart-api",
          environment: process.env.NODE_ENV || "development",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          database: "disconnected",
          error: err?.message || "Database connection error",
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
