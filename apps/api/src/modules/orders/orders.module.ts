import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { ActionLinksController } from "./action-links.controller";
import { OrdersController } from "./orders.controller";
import { StopController } from "./stop.controller";
import { PrismaModule } from "../../prisma/prisma.module";
import { SMSHubModule } from "../smshub/smshub.module";
import { CryptoModule } from "../crypto/crypto.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, SMSHubModule, CryptoModule, AuthModule],
  controllers: [ActionLinksController, OrdersController, StopController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
