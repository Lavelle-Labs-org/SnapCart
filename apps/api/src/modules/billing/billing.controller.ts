import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Inject,
} from "@nestjs/common";
import { SellerAuthGuard } from "../auth/auth.guard";
import { CurrentSeller } from "../auth/current-seller.decorator";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(
    @Inject(BillingService)
    private readonly billingService: BillingService
  ) {}

  @Get("balance")
  @UseGuards(SellerAuthGuard)
  async getBalance(@CurrentSeller() seller: any) {
    return this.billingService.getBalance(seller.id);
  }

  @Get("packages")
  getPackages() {
    return this.billingService.getPackages();
  }

  @Get("transactions")
  @UseGuards(SellerAuthGuard)
  async getTransactions(@CurrentSeller() seller: any) {
    return this.billingService.getTransactions(seller.id);
  }

  @Post("checkout")
  @UseGuards(SellerAuthGuard)
  async initializeCheckout(
    @CurrentSeller() seller: any,
    @Body() body: { packageId: string; returnUrl?: string }
  ) {
    return this.billingService.initializeCheckout(
      seller.id,
      body.packageId,
      body.returnUrl
    );
  }

  @Get("verify/:txRef")
  @UseGuards(SellerAuthGuard)
  async verifyPayment(
    @CurrentSeller() seller: any,
    @Param("txRef") txRef: string
  ) {
    return this.billingService.verifyAndApplyPayment(txRef, seller.id);
  }
}
