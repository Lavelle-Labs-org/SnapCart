import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SellerAuthGuard } from "./auth.guard";
import { CurrentSeller } from "./current-seller.decorator";
import type { Seller } from "@prisma/client";
import type { UpdateSettingsDto } from "./auth.types";

/**
 * Settings Controller (PR-012, Issue #131).
 * Alias controller exposing /api/settings endpoints mapped to seller settings
 * for backwards compatibility alongside /api/auth/settings.
 */
@Controller("settings")
export class SettingsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @UseGuards(SellerAuthGuard)
  async getSettings(@CurrentSeller() seller: Seller) {
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

  @Patch()
  @UseGuards(SellerAuthGuard)
  async updateSettings(
    @CurrentSeller() seller: Seller,
    @Body() dto: UpdateSettingsDto
  ) {
    return this.authService.updateSettings(seller.id, dto);
  }
}
