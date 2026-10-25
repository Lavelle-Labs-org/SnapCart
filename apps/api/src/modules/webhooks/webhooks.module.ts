import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { WebhookSignatureGuard } from "./webhook-signature.guard";
import { PrismaModule } from "../../prisma/prisma.module";
import { CryptoModule } from "../crypto/crypto.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [PrismaModule, CryptoModule, BillingModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureGuard],
  exports: [WebhooksService, WebhookSignatureGuard],
})
export class WebhooksModule {}
