import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { CheckoutService } from "./checkout.service";

@Controller("checkout")
export class CheckoutController {
  constructor(
    @Inject(CheckoutService)
    private readonly checkoutService: CheckoutService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async checkout(@Body() body: any) {
    return this.checkoutService.checkout(body);
  }

  @Post("resend")
  @HttpCode(HttpStatus.OK)
  async resendCheckoutOtp(@Body() body: any) {
    return this.checkoutService.resendCheckoutOtp(body);
  }
}
