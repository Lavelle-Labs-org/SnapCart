import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { Request } from "express";
import { CheckoutService } from "./checkout.service";
import { extractClientIp } from "../../lib/rate-limit";

@Controller("checkout")
export class CheckoutController {
  constructor(
    @Inject(CheckoutService)
    private readonly checkoutService: CheckoutService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async checkout(@Body() body: any, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.checkoutService.checkout(body, clientIp);
  }

  @Post("resend")
  @HttpCode(HttpStatus.OK)
  async resendCheckoutOtp(@Body() body: any, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.checkoutService.resendCheckoutOtp(body, clientIp);
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  async verifyCheckout(@Body() body: any) {
    return this.checkoutService.verifyCheckout(body);
  }
}
