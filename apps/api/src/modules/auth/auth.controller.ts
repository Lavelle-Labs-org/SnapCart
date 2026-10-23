import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Res,
  Req,
  UseGuards,
  Inject,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { extractClientIp } from "../../lib/rate-limit";
import { SellerAuthGuard } from "./auth.guard";
import { CurrentSeller } from "./current-seller.decorator";
import { serializeCookie } from "./auth.types";
import type {
  SignupDto,
  VerifyPhoneDto,
  LoginDto,
  UpdateSettingsDto,
} from "./auth.types";
import type { Seller } from "@prisma/client";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Post("signup")
  async signup(@Body() dto: SignupDto, @Req() req: Request) {
    const clientIp = extractClientIp(req);
    return this.authService.signup(dto, clientIp);
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const clientIp = extractClientIp(req);
    const result = await this.authService.login(dto, clientIp);
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
        businessName: seller.business_name,
        smsName: seller.sms_name,
        phone: seller.phone,
        slug: seller.slug,
        phoneVerifiedAt: seller.phone_verified_at?.toISOString() ?? null,
        createdAt: seller.created_at.toISOString(),
      },
    };
  }

  @Get("settings")
  @UseGuards(SellerAuthGuard)
  async getSettings(@CurrentSeller() seller: Seller) {
    return this.me(seller);
  }

  @Patch("settings")
  @UseGuards(SellerAuthGuard)
  async updateSettings(
    @CurrentSeller() seller: Seller,
    @Body() dto: UpdateSettingsDto
  ) {
    return this.authService.updateSettings(seller.id, dto);
  }
}
