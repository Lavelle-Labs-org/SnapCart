import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { MessagesService } from "./messages.service";
import { SellerAuthGuard } from "../auth/auth.guard";
import { CurrentSeller } from "../auth/current-seller.decorator";
import { extractClientIp } from "../../lib/rate-limit";
import type { MessageDto } from "@order-by-sms/contracts";

@Controller("messages")
@UseGuards(SellerAuthGuard)
export class MessagesController {
  constructor(
    @Inject(MessagesService)
    private readonly messagesService: MessagesService
  ) {}

  /**
   * GET /api/messages
   * Lists all outgoing and incoming SMS messages for the authenticated seller.
   */
  @Get()
  async getMessages(@CurrentSeller() seller: any): Promise<MessageDto[]> {
    return this.messagesService.getMessages(seller.id);
  }

  /**
   * POST /api/messages/:id/resend
   * Manually retries failed or unknown SMS messages directly from the audit log (BE-016).
   */
  @Post(":id/resend")
  @HttpCode(HttpStatus.OK)
  async resendMessage(
    @CurrentSeller() seller: any,
    @Param("id") id: string,
    @Req() req: Request
  ): Promise<{ resent: boolean; message: MessageDto }> {
    const clientIp = extractClientIp(req);
    return this.messagesService.resendMessage(id, seller.id, clientIp);
  }
}
