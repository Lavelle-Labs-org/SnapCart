import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { SellerAuthGuard } from "./auth.guard";
import { CurrentSeller } from "./current-seller.decorator";
import { serializeCookie } from "./auth.types";
import type {
  SignupDto,
  VerifyPhoneDto,
  LoginDto,
} from "./auth.types";
import type { Seller } from "@prisma/client";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Post("signup")
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post("verify-phone")
  async verifyPhone(
    @Body() dto: VerifyPhoneDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.verifyPhone(dto);
    res.setHeader("Set-Cookie", serializeCookie(result.cookie));
    return {
      seller: result.seller,
    };
  }

  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.login(dto);
    res.setHeader("Set-Cookie", serializeCookie(result.cookie));
    return {
      seller: result.seller,
    };
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    const clearCookie = this.authService.createClearSessionCookie();
    res.setHeader("Set-Cookie", serializeCookie(clearCookie));
    return {
      message: "Logged out successfully",
    };
  }

  @Get("me")
  @UseGuards(SellerAuthGuard)
  async me(@CurrentSeller() seller: Seller) {
    return {
      seller: {
        id: seller.id,
        business_name: seller.business_name,
        sms_name: seller.sms_name,
        phone: seller.phone,
        slug: seller.slug,
        phone_verified_at: seller.phone_verified_at,
        created_at: seller.created_at,
      },
    };
  }
}
