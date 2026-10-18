import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { SMSHubModule } from "../smshub/smshub.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [PrismaModule, SMSHubModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
