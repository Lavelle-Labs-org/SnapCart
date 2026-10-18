import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { WebhookSignatureGuard } from "./webhook-signature.guard";
import { PrismaModule } from "../../prisma/prisma.module";
import { CryptoModule } from "../crypto/crypto.module";

@Module({
  imports: [PrismaModule, CryptoModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureGuard],
  exports: [WebhooksService, WebhookSignatureGuard],
})
export class WebhooksModule {}
