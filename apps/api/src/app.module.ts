import { Module } from "@nestjs/common";
import { AuthModule } from "./modules/auth/auth.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { CryptoModule } from "./modules/crypto/crypto.module";
import { HealthModule } from "./modules/health/health.module";
import { ProductsModule } from "./modules/products/products.module";
import { SMSHubModule } from "./modules/smshub/smshub.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { PrismaModule } from "./prisma/prisma.module";

import { APP_PIPE } from "@nestjs/core";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe";

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    SMSHubModule,
    AuthModule,
    ProductsModule,
    CheckoutModule,
    OrdersModule,
    MessagesModule,
    WebhooksModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ZodValidationPipe({ whitelist: true }),
    },
  ],
})
export class AppModule {}
