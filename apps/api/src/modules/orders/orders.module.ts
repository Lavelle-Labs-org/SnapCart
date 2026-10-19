import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { ActionLinksController } from "./action-links.controller";
import { PrismaModule } from "../../prisma/prisma.module";
import { SMSHubModule } from "../smshub/smshub.module";
import { CryptoModule } from "../crypto/crypto.module";

@Module({
  imports: [PrismaModule, SMSHubModule, CryptoModule],
  controllers: [ActionLinksController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
