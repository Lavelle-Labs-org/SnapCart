import { Module, Global } from "@nestjs/common";
import { SMSHubService } from "./smshub.service";

@Global()
@Module({
  providers: [SMSHubService],
  exports: [SMSHubService],
})
export class SMSHubModule {}
