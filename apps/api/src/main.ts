import "reflect-metadata";
import * as path from "node:path";
import express from "express";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { validateEnv, env } from "./config/env";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";

export async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // Fail fast during boot if critical environment variables are missing
  validateEnv();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // HTTP security headers (PR-015, Issue #134)
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Static files for local image uploads fallback
  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  app.use("/uploads", express.static(uploadsDir));

  // Global API routing prefix (excluding webhooks per SMSHub spec)
  app.setGlobalPrefix("api", {
    exclude: ["webhooks/smshub", "webhooks/(.*)", "api/webhooks/smshub", "api/webhooks/(.*)"],
  });

  // CORS configuration for frontend origin with credentials
  app.enableCors({
    origin: [
      env.FRONTEND_URL || "http://localhost:3000",
      env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-SMSHub-Signature", "X-SMSHub-Event", "X-SMSHub-Delivery"],
  });

  // Global validation pipe with whitelist stripping (PR-017, #136)
  app.useGlobalPipes(new ZodValidationPipe({ whitelist: true }));

  // Global response transformer and exception handler
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable shutdown hooks
  app.enableShutdownHooks();

  const port = env.PORT || 4000;
  await app.listen(port);
  logger.log(`🚀 Snapcart NestJS API running on: http://localhost:${port}/api`);
  return app;
}

// Start application if executed directly
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("❌ Fatal bootstrap error in apps/api:", err);
    process.exit(1);
  });
}
