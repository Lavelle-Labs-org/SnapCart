import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { SMSHubModule } from "../smshub/smshub.module";
import { CryptoModule } from "../crypto/crypto.module";

@Module({
  imports: [PrismaModule, SMSHubModule, CryptoModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
