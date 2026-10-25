import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { CheckoutService } from "./checkout.service";
import { extractClientIp } from "../../lib/rate-limit";
import { serializeCookie } from "../auth/auth.types";
import {
  CheckoutDto,
  ResendCheckoutOtpDto,
  VerifyCheckoutDto,
} from "./checkout.dto";

@Controller("checkout")
export class CheckoutController {
  constructor(
    @Inject(CheckoutService)
    private readonly checkoutService: CheckoutService
  ) {}

  @Get("buyer/me")
  async getBuyerProfile(@Req() req: Request) {
    return this.checkoutService.getBuyerProfile(req);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async checkout(
    @Body() body: CheckoutDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const clientIp = extractClientIp(req);
    const result = await this.checkoutService.checkout(body, clientIp, req);
    if (result.cookie) {
      res.setHeader("Set-Cookie", serializeCookie(result.cookie));
    }
    return result;
  }

  @Post("resend")
  @HttpCode(HttpStatus.OK)
  async resendCheckoutOtp(
    @Body() body: ResendCheckoutOtpDto,
    @Req() req: Request
  ) {
    const clientIp = extractClientIp(req);
    return this.checkoutService.resendCheckoutOtp(body, clientIp);
  }

  @Post("verify")
  @HttpCode(HttpStatus.OK)
  async verifyCheckout(
    @Body() body: VerifyCheckoutDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.checkoutService.verifyCheckout(body);
    if (result.cookie) {
      res.setHeader("Set-Cookie", serializeCookie(result.cookie));
    }
    return {
      orderNumber: result.orderNumber,
      orderId: result.orderId,
      order: result.order,
    };
  }
}
