import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(options?: { databaseUrl?: string }) {
    let dbUrl = options?.databaseUrl;
    if (!dbUrl) {
      try {
        dbUrl = env.DATABASE_URL;
      } catch {
        dbUrl =
          process.env.DATABASE_URL ||
          "postgresql://postgres:postgres@localhost:5432/order_by_sms?schema=public";
      }
    }

    super({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error"],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("✔ Connected to PostgreSQL database via Prisma");
    } catch (err: any) {
      if (process.env.NODE_ENV === "test") {
        this.logger.warn(`Database connection skipped in test environment: ${err.message}`);
        return;
      }
      this.logger.error(`Failed to connect to database: ${err.message}`, err.stack);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("✔ Disconnected from PostgreSQL database");
  }
}
