import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SellerAuthGuard } from "./auth.guard";
import { PrismaModule } from "../../prisma/prisma.module";
import { SMSHubModule } from "../smshub/smshub.module";

@Module({
  imports: [PrismaModule, SMSHubModule],
  controllers: [AuthController],
  providers: [AuthService, SellerAuthGuard],
  exports: [AuthService, SellerAuthGuard],
})
export class AuthModule {}
