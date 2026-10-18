import {
  Injectable,
  Inject,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SMSHubService } from "../smshub/smshub.service";
import { truncateShopName } from "../smshub/templates";
import { normalizeEthiopianPhone } from "@order-by-sms/contracts";
import type { CheckoutResponse } from "@order-by-sms/contracts";
import {
  CheckoutSchema,
  ResendCheckoutOtpSchema,
} from "./checkout.dto";

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SMSHubService)
    private readonly smshubService: SMSHubService
  ) {}

  /**
   * Guest Checkout Submission (BE-008, FR-7, FR-8, FR-9, FR-11)
   * 1. Validates buyer details, phone format, and cart item availability.
   * 2. Authoritatively calculates total Santim.
   * 3. Dispatches 6-digit OTP via SMSHub Verify API with seller shop name.
   * 4. Stores serialized cart details in phone_verifications.draft.
   */
  async checkout(input: any): Promise<CheckoutResponse> {
    const parseResult = CheckoutSchema.safeParse(input);
    if (!parseResult.success) {
      const firstError =
        parseResult.error.errors[0]?.message || "Invalid checkout payload";
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: firstError,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { slug, items } = parseResult.data;
    const buyerName = (parseResult.data.buyerName ?? parseResult.data.buyer_name)!.trim();
    const rawPhone = (parseResult.data.buyerPhone ?? parseResult.data.buyer_phone)!.trim();
    const phoneRes = normalizeEthiopianPhone(rawPhone);
    const normalizedPhone = phoneRes.normalized;

    const smsConsent = parseResult.data.smsConsent ?? parseResult.data.sms_consent ?? false;
    const consentWording =
      parseResult.data.consentWording ??
      parseResult.data.consent_wording ??
      "Send me SMS updates about this order";

    // 1. Verify seller exists
    const seller = await this.prisma.seller.findUnique({
      where: { slug },
    });

    if (!seller) {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: `Seller storefront with slug "${slug}" not found`,
        },
        HttpStatus.NOT_FOUND
      );
    }

    // 2. Fetch active products and calculate authoritative total
    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        seller_id: seller.id,
        available: true,
        deleted_at: null,
      },
    });

    if (products.length !== productIds.length) {
      throw new HttpException(
        {
          code: "PRODUCT_UNAVAILABLE",
          message: "One or more products in your cart are no longer available",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let totalSantim = 0;
    const itemDetails = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPriceSantim = product.price_santim;
      totalSantim += unitPriceSantim * item.quantity;
      return {
        productId: product.id,
        name: product.name,
        unitPriceSantim,
        quantity: item.quantity,
      };
    });

    // 3. Dispatch OTP via SMSHub Verify API
    const shopName = truncateShopName(seller.sms_name || seller.business_name);
    let verifyRes;
    try {
      verifyRes = await this.smshubService.verifySend(
        normalizedPhone,
        shopName,
        6,
        300
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to dispatch verification OTP to ${normalizedPhone}: ${err?.message || err}`,
        err?.stack
      );
      throw new HttpException(
        {
          code: "OTP_DISPATCH_FAILED",
          message:
            err?.message || "Failed to dispatch verification code via SMSHub",
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    if (verifyRes.status === "error" || !verifyRes.data?.verification_id) {
      throw new HttpException(
        {
          code: "OTP_DISPATCH_FAILED",
          message:
            verifyRes.message || "SMSHub could not send verification code",
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    // 4. Serialize cart and consent into phone_verifications.draft
    const draftPayload = {
      sellerId: seller.id,
      slug: seller.slug,
      buyerName,
      buyerPhone: normalizedPhone,
      smsConsent,
      consentWording,
      totalSantim,
      items: itemDetails,
    };

    const expiresAt = new Date(Date.now() + 300 * 1000);
    const verification = await this.prisma.phoneVerification.create({
      data: {
        phone: normalizedPhone,
        purpose: "buyer_checkout",
        verification_id: verifyRes.data.verification_id,
        status: "pending",
        expires_at: expiresAt,
        last_sent_at: new Date(),
        draft: JSON.stringify(draftPayload),
      },
    });

    this.logger.log(
      `Created checkout verification draft ${verification.id} for ${normalizedPhone} (Shop: ${shopName})`
    );

    return {
      draftId: verification.id,
      phone: normalizedPhone,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Resend Checkout OTP (BE-008, FR-13)
   * Enforces 60-second cooldown timer based on last_sent_at.
   */
  async resendCheckoutOtp(
    input: any
  ): Promise<{ sent: boolean; retryAfter: number }> {
    const rawId = typeof input === "string" ? input : input?.draftId ?? input?.draft_id;
    const parseResult = ResendCheckoutOtpSchema.safeParse({ draftId: rawId });

    if (!parseResult.success) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: "draftId is required",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const draftId = parseResult.data.draftId!;

    const verification = await this.prisma.phoneVerification.findUnique({
      where: { id: draftId },
    });

    if (!verification || verification.purpose !== "buyer_checkout") {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: "Verification draft not found",
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (verification.status !== "pending") {
      throw new HttpException(
        {
          code: "VERIFICATION_NOT_PENDING",
          message: "This verification has already been completed or expired",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Enforce 60-second application cooldown (FR-13)
    const elapsedSeconds = Math.floor(
      (Date.now() - verification.last_sent_at.getTime()) / 1000
    );
    const COOLDOWN_SECONDS = 60;

    if (elapsedSeconds < COOLDOWN_SECONDS) {
      const retryAfter = COOLDOWN_SECONDS - elapsedSeconds;
      throw new HttpException(
        {
          code: "RATE_LIMITED",
          message: `Please wait ${retryAfter} seconds before requesting a new code.`,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    // Resolve shopName from serialized draft
    let shopName = "Shop";
    try {
      if (verification.draft) {
        const parsed = JSON.parse(verification.draft);
        if (parsed.sellerId) {
          const seller = await this.prisma.seller.findUnique({
            where: { id: parsed.sellerId },
          });
          if (seller) {
            shopName = truncateShopName(seller.sms_name || seller.business_name);
          }
        }
      }
    } catch {
      // Fallback to default
    }

    let verifyRes;
    try {
      verifyRes = await this.smshubService.verifySend(
        verification.phone,
        shopName,
        6,
        300
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to resend verification OTP to ${verification.phone}: ${err?.message || err}`,
        err?.stack
      );
      throw new HttpException(
        {
          code: "OTP_DISPATCH_FAILED",
          message:
            err?.message || "Failed to resend verification code via SMSHub",
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    if (verifyRes.status === "error" || !verifyRes.data?.verification_id) {
      throw new HttpException(
        {
          code: "OTP_DISPATCH_FAILED",
          message:
            verifyRes.message || "SMSHub could not resend verification code",
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    await this.prisma.phoneVerification.update({
      where: { id: verification.id },
      data: {
        verification_id: verifyRes.data.verification_id,
        last_sent_at: new Date(),
        expires_at: new Date(Date.now() + 300 * 1000),
      },
    });

    this.logger.log(
      `Resent checkout verification OTP for draft ${verification.id} to ${verification.phone}`
    );

    return {
      sent: true,
      retryAfter: COOLDOWN_SECONDS,
    };
  }
}
