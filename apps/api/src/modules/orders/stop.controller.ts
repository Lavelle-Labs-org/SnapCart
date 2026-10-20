import {
  Controller,
  Get,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OptOutResponse, OptOutPreviewResponse } from "@order-by-sms/contracts";

@Controller("stop")
export class StopController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService
  ) {}

  /**
   * GET /api/stop/:token (docs/06 Sec 1)
   * Read-only preview of opt-out token details for /x/[token] page.
   * Safe for scrapers; strictly no side effects.
   */
  @Get(":token")
  @HttpCode(HttpStatus.OK)
  async getStopDetails(
    @Param("token") token: string
  ): Promise<OptOutPreviewResponse> {
    return this.ordersService.getStopTokenDetails(token);
  }

  /**
   * POST /api/stop/:token (BE-015, #21)
   * Buyer SMS opt-out confirmation.
   * Verifies stop token bound to order and buyer,
   * adds phone to suppression_list (idempotent upsert),
   * revokes token, and ensures subsequent buyer SMS messages are skipped.
   */
  @Post(":token")
  @HttpCode(HttpStatus.OK)
  async optOut(@Param("token") token: string): Promise<OptOutResponse> {
    return this.ordersService.optOutBuyer(token);
  }
}
