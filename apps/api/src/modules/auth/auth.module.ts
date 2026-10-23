import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { SettingsController } from "./settings.controller";
import { AuthService } from "./auth.service";
import { SellerAuthGuard } from "./auth.guard";
import { PrismaModule } from "../../prisma/prisma.module";
import { SMSHubModule } from "../smshub/smshub.module";

@Module({
  imports: [PrismaModule, SMSHubModule],
  controllers: [AuthController, SettingsController],
  providers: [AuthService, SellerAuthGuard],
  exports: [AuthService, SellerAuthGuard],
})
export class AuthModule {}
