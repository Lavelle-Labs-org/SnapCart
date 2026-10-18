import { Module } from "@nestjs/common";
import { CryptoModule } from "./modules/crypto/crypto.module";
import { HealthModule } from "./modules/health/health.module";
import { SMSHubModule } from "./modules/smshub/smshub.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, CryptoModule, SMSHubModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
