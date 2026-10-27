import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthService } from "./auth.service";
import { SellerAuthGuard } from "./auth.guard";
import { CurrentSeller } from "./current-seller.decorator";
import type { Seller } from "@prisma/client";
import type { UpdateSettingsDto } from "./auth.types";

/**
 * Settings Controller (PR-012, Issue #131).
 * Exposing /api/settings endpoints mapped to seller settings
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
        logoUrl: seller.logo_url ?? null,
        logo_url: seller.logo_url ?? null,
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

  @Post("profile-image")
  @UseGuards(SellerAuthGuard)
  @UseInterceptors(FileInterceptor("image"))
  async uploadProfileImage(
    @CurrentSeller() seller: Seller,
    @UploadedFile() file: any
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Image file is required");
    }

    return this.authService.uploadProfileImage(
      seller.id,
      file.buffer,
      file.originalname || "profile.jpg"
    );
  }

  @Delete("profile-image")
  @UseGuards(SellerAuthGuard)
  async deleteProfileImage(@CurrentSeller() seller: Seller) {
    return this.authService.deleteProfileImage(seller.id);
  }
}

