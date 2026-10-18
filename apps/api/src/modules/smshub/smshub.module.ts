import { Module, Global } from "@nestjs/common";
import { SMSHubService } from "./smshub.service";
import { SMSOrchestratorService } from "./sms-orchestrator.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SMSHubService, SMSOrchestratorService],
  exports: [SMSHubService, SMSOrchestratorService],
})
export class SMSHubModule {}
