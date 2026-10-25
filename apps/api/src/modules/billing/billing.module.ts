import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ChapaService } from "./chapa.service";
import { BillingService } from "./billing.service";
import { BillingController } from "./billing.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BillingController],
  providers: [ChapaService, BillingService],
  exports: [BillingService, ChapaService],
})
export class BillingModule {}
