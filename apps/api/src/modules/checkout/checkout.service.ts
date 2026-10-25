import {
  Injectable,
  Inject,
  Optional,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SMSHubService } from "../smshub/smshub.service";
import { SMSOrchestratorService } from "../smshub/sms-orchestrator.service";
import {
  CryptoService,
  generateActionToken,
  hashActionToken,
} from "../crypto/crypto.service";
import { truncateShopName } from "../smshub/templates";
import { normalizeEthiopianPhone } from "@order-by-sms/contracts";
import type { CheckoutResponse, OrderDto } from "@order-by-sms/contracts";
import {
  CheckoutSchema,
  ResendCheckoutOtpSchema,
  VerifyCheckoutSchema,
} from "./checkout.dto";
import {
  checkPhoneRateLimit,
  checkIpRateLimit,
  enforceRateLimit,
  getRateLimitConfig,
} from "../../lib/rate-limit";
import {
  signBuyerToken,
  verifyBuyerToken,
  createBuyerSessionCookie,
  extractBuyerTokenFromRequest,
} from "./buyer-auth";
import type { SessionCookieOptions } from "../auth/auth.types";

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SMSHubService)
    private readonly smshubService: SMSHubService,
    @Optional()
    @Inject(SMSOrchestratorService)
    private readonly smsOrchestrator?: SMSOrchestratorService,
    @Optional()
    @Inject(CryptoService)
    private readonly cryptoService?: CryptoService
  ) {}

  /**
   * Guest Checkout Submission (BE-008, FR-7, FR-8, FR-9, FR-11)
   * 1. Validates buyer details, phone format, and cart item availability.
   * 2. Authoritatively calculates total Santim.
   * 3. Dispatches 6-digit OTP via SMSHub Verify API with seller shop name.
   * 4. Stores serialized cart details in phone_verifications.draft.
   * 5. If returning recognized buyer (valid buyer_session matching phone), skips OTP and creates order immediately.
   */
  async checkout(
    input: any,
    clientIp?: string,
    req?: any
  ): Promise<CheckoutResponse & { cookie?: SessionCookieOptions }> {
    const parseResult = CheckoutSchema.safeParse(input);
    if (!parseResult.success) {
      const firstError =
        ((parseResult.error as any).issues?.[0]?.message ||
          (parseResult.error as any).errors?.[0]?.message) ||
        "Invalid checkout payload";
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

    // Rate limit checks (PR-005, Issue #124, configurable via env)
    if (clientIp) {
      const ipLimit = await checkIpRateLimit(this.prisma, clientIp);
      enforceRateLimit(
        ipLimit,
        "Too many checkout attempts from this IP address. Please try again later."
      );
    }

    const phoneLimit = await checkPhoneRateLimit(this.prisma, normalizedPhone);
    enforceRateLimit(
      phoneLimit,
      `Too many checkout verification attempts for ${normalizedPhone}. Maximum ${phoneLimit.limit} attempts per hour.`
    );

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

    // 3. Check for recognized returning buyer (Instant Checkout - BE-008, FR-7)
    const token = extractBuyerTokenFromRequest(req);
    if (token) {
      const buyerSession = await verifyBuyerToken(token);
      if (buyerSession && buyerSession.phone === normalizedPhone) {
        let customer: any = null;
        if (typeof this.prisma.customer?.findUnique === "function") {
          customer = await this.prisma.customer.findUnique({
            where: { phone: normalizedPhone },
          });
        }

        if (customer && customer.phone_verified_at) {
          this.logger.log(
            `[Instant Checkout] Recognized returning buyer ${normalizedPhone} (Customer ${customer.id}). Bypassing OTP verification.`
          );

          if (
            typeof this.prisma.customer?.update === "function" &&
            customer.name !== buyerName
          ) {
            await this.prisma.customer
              .update({
                where: { id: customer.id },
                data: { name: buyerName },
              })
              .catch(() => {});
          }

          const orderResult = await this.executeOrderCreation({
            seller,
            draftData: draftPayload,
            customerId: customer.id,
          });

          let refreshedCookie: SessionCookieOptions | undefined;
          try {
            const refreshedToken = await signBuyerToken({
              customerId: customer.id,
              phone: normalizedPhone,
              name: buyerName,
            });
            refreshedCookie = createBuyerSessionCookie(refreshedToken);
          } catch (err: any) {
            this.logger.warn(`Failed to refresh buyer cookie: ${err?.message || err}`);
          }

          return {
            verified: true,
            orderId: orderResult.orderId,
            orderNumber: orderResult.orderNumber,
            order: orderResult.order,
            cookie: refreshedCookie,
          };
        }
      }
    }

    // 4. Dispatch OTP via SMSHub Verify API for first-time or unrecognized buyer
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

    // 5. Serialize cart and consent into phone_verifications.draft
    const expiresAt = new Date(Date.now() + getRateLimitConfig().otpExpiry * 1000);
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
      verified: false,
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
    input: any,
    clientIp?: string
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

    // Rate limit checks (PR-005, Issue #124, configurable via env)
    if (clientIp) {
      const ipLimit = await checkIpRateLimit(this.prisma, clientIp);
      enforceRateLimit(
        ipLimit,
        "Too many OTP resend attempts from this IP address. Please try again later."
      );
    }

    const phoneLimit = await checkPhoneRateLimit(this.prisma, verification.phone);
    enforceRateLimit(
      phoneLimit,
      `Too many OTP resend attempts for ${verification.phone}. Maximum ${phoneLimit.limit} attempts per hour.`
    );

    // Enforce application cooldown (FR-13, configurable via RATE_LIMIT_OTP_COOLDOWN_SECONDS)
    const elapsedSeconds = Math.floor(
      (Date.now() - verification.last_sent_at.getTime()) / 1000
    );
    const COOLDOWN_SECONDS = getRateLimitConfig().otpCooldown;

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
        expires_at: new Date(Date.now() + getRateLimitConfig().otpExpiry * 1000),
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

  /**
   * Phone Verification & Authoritative Order Creation (BE-009, FR-10, FR-14, FR-21)
   * 1. Validates OTP via SMSHub verifyCheck.
   * 2. Recalculates cart total from active database products.
   * 3. Atomically creates order, order items, order event, and action token.
   * 4. Dispatches new-order alert SMS with action link to the seller.
   * 5. Returns order details with orderId and orderNumber.
   */
  async verifyCheckout(input: any): Promise<{
    orderNumber: number;
    orderId: string;
    order: OrderDto;
    cookie?: SessionCookieOptions;
  }> {
    const rawDraftId = input?.draftId ?? input?.draft_id;
    const parseResult = VerifyCheckoutSchema.safeParse({
      draftId: rawDraftId,
      code: input?.code,
    });

    if (!parseResult.success) {
      const firstError =
        ((parseResult.error as any).issues?.[0]?.message ||
          (parseResult.error as any).errors?.[0]?.message) ||
        "Invalid verification input";
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: firstError,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { draftId, code } = parseResult.data;

    // 1. Look up verification draft
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

    if (verification.status === "approved") {
      throw new HttpException(
        {
          code: "ALREADY_VERIFIED",
          message: "This checkout verification has already been completed",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (verification.status !== "pending") {
      throw new HttpException(
        {
          code: "VERIFICATION_NOT_PENDING",
          message: "Verification is not pending",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (verification.expires_at < new Date()) {
      throw new HttpException(
        {
          code: "CODE_EXPIRED",
          message: "Verification code has expired. Please request a new code.",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 2. Call SMSHub verifyCheck to validate OTP
    let checkRes;
    try {
      checkRes = await this.smshubService.verifyCheck(
        verification.verification_id,
        code.trim()
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to verify OTP with SMSHub for draft ${draftId}: ${err?.message || err}`,
        err?.stack
      );
      throw new HttpException(
        {
          code: "VERIFICATION_SERVICE_ERROR",
          message:
            err?.message || "Failed to contact SMSHub verification service",
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    if (
      !checkRes.data?.valid ||
      checkRes.data?.verification_status !== "approved"
    ) {
      throw new HttpException(
        {
          code: "INVALID_CODE",
          message:
            "Invalid or expired verification code. Please check and try again.",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 3. Parse serialized draft payload
    let draftData: any;
    try {
      draftData = JSON.parse(verification.draft || "{}");
    } catch {
      throw new HttpException(
        {
          code: "DRAFT_CORRUPTED",
          message: "Failed to parse checkout draft data",
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // 4. Recalculate item prices from database for authoritative total
    const productIds: string[] = draftData.items.map((i: any) => i.productId);
    const currentProducts = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        seller_id: draftData.sellerId,
      },
    });

    const productMap = new Map(currentProducts.map((p) => [p.id, p]));
    let totalSantim = 0;
    const finalItems = draftData.items.map((item: any) => {
      const prod = productMap.get(item.productId);
      const unitPriceSantim = prod ? prod.price_santim : item.unitPriceSantim;
      totalSantim += unitPriceSantim * item.quantity;
      return {
        productId: item.productId,
        name: prod ? prod.name : item.name,
        unitPriceSantim,
        quantity: item.quantity,
      };
    });

    // 5. Upsert Customer in database upon successful phone verification
    let customerId: string | undefined;
    if (typeof this.prisma.customer?.upsert === "function") {
      try {
        const customer = await this.prisma.customer.upsert({
          where: { phone: draftData.buyerPhone },
          update: {
            name: draftData.buyerName,
            phone_verified_at: new Date(),
          },
          create: {
            phone: draftData.buyerPhone,
            name: draftData.buyerName,
            phone_verified_at: new Date(),
          },
        });
        customerId = customer?.id;
      } catch (err: any) {
        this.logger.warn(
          `Failed to upsert customer for ${draftData.buyerPhone}: ${err?.message || err}`
        );
      }
    }

    // 6. Execute authoritative order creation
    const seller = await this.prisma.seller.findUnique({
      where: { id: draftData.sellerId },
    });

    const orderResult = await this.executeOrderCreation({
      seller,
      draftData: {
        sellerId: draftData.sellerId,
        slug: draftData.slug,
        buyerName: draftData.buyerName,
        buyerPhone: draftData.buyerPhone,
        smsConsent: draftData.smsConsent,
        consentWording: draftData.consentWording,
        items: finalItems,
        totalSantim,
      },
      customerId,
      verificationId: verification.id,
    });

    // 7. Issue buyer session cookie for future frictionless checkouts
    let buyerCookie: SessionCookieOptions | undefined;
    if (customerId) {
      try {
        const token = await signBuyerToken({
          customerId,
          phone: draftData.buyerPhone,
          name: draftData.buyerName,
        });
        buyerCookie = createBuyerSessionCookie(token);
      } catch (err: any) {
        this.logger.warn(
          `Failed to create buyer session cookie: ${err?.message || err}`
        );
      }
    }

    return {
      orderNumber: orderResult.orderNumber,
      orderId: orderResult.orderId,
      order: orderResult.order,
      cookie: buyerCookie,
    };
  }

  /**
   * Authoritative Order Creation helper (shared between OTP verification and Instant Checkout).
   */
  private async executeOrderCreation(params: {
    seller: any;
    draftData: {
      sellerId: string;
      slug?: string;
      buyerName: string;
      buyerPhone: string;
      smsConsent: boolean;
      consentWording: string;
      items: Array<{
        productId: string;
        name: string;
        unitPriceSantim: number;
        quantity: number;
      }>;
      totalSantim: number;
    };
    customerId?: string | null;
    verificationId?: string;
  }): Promise<{
    orderNumber: number;
    orderId: string;
    order: OrderDto;
  }> {
    const { seller, draftData, customerId, verificationId } = params;

    // 1. Generate 22-character action token & SHA-256 hash
    const actionToken = this.cryptoService
      ? this.cryptoService.generateActionToken()
      : generateActionToken();
    const tokenHash = this.cryptoService
      ? this.cryptoService.hashActionToken(actionToken)
      : hashActionToken(actionToken);
    const tokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    // 2. Execute atomic database transaction with optimistic retry on order number collision (PR-008, Issue #127)
    const MAX_ORDER_NUMBER_RETRIES = 5;
    let createdOrder: any;

    for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_RETRIES; attempt++) {
      try {
        createdOrder = await this.prisma.$transaction(async (tx) => {
          // Find highest order number for this seller
          const lastOrder = await tx.order.findFirst({
            where: { seller_id: draftData.sellerId },
            orderBy: { number: "desc" },
            select: { number: true },
          });
          const orderNumber = lastOrder ? lastOrder.number + 1 : 1001;

          // Create order with nested order_items, order_events, and action_tokens
          const order = await tx.order.create({
            data: {
              seller_id: draftData.sellerId,
              customer_id: customerId ?? null,
              number: orderNumber,
              buyer_name: draftData.buyerName,
              buyer_phone: draftData.buyerPhone,
              sms_consent: draftData.smsConsent,
              consent_wording: draftData.consentWording,
              consent_at: draftData.smsConsent ? new Date() : null,
              state: "new",
              total_santim: draftData.totalSantim,
              order_items: {
                create: draftData.items.map((item: any) => ({
                  product_id: item.productId,
                  name_at_order: item.name,
                  unit_price_santim: item.unitPriceSantim,
                  quantity: item.quantity,
                })),
              },
              order_events: {
                create: {
                  from_state: null,
                  to_state: "new",
                  actor: "buyer",
                },
              },
              action_tokens: {
                create: {
                  purpose: "seller_action",
                  token_hash: tokenHash,
                  expires_at: tokenExpiresAt,
                },
              },
            },
            include: {
              order_items: true,
            },
          });

          // Mark verification draft as approved (if OTP verification was used)
          if (verificationId) {
            await tx.phoneVerification.update({
              where: { id: verificationId },
              data: { status: "approved" },
            });
          }

          return order;
        });

        // Transaction succeeded
        break;
      } catch (err: any) {
        const isUniqueConstraintViolation =
          err?.code === "P2002" ||
          err?.message?.includes("P2002") ||
          err?.message?.includes("Unique constraint failed");

        if (isUniqueConstraintViolation && attempt < MAX_ORDER_NUMBER_RETRIES) {
          this.logger.warn(
            `[Order Number Collision] P2002 collision on order creation for seller ${draftData.sellerId} on attempt ${attempt}/${MAX_ORDER_NUMBER_RETRIES}. Retrying with next sequence number...`
          );
          // Randomized jitter (10ms - 30ms) to avoid lock-step retries across concurrent threads
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 20) + 10)
          );
          continue;
        }

        throw err;
      }
    }

    if (!createdOrder) {
      throw new HttpException(
        {
          code: "ORDER_CREATION_FAILED",
          message:
            "Failed to allocate sequential order number after multiple retries",
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // 3. Dispatch new-order alert SMS with action link to seller
    const targetSeller =
      seller ||
      (await this.prisma.seller.findUnique({
        where: { id: draftData.sellerId },
      }));

    if (targetSeller && this.smsOrchestrator) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:3000";
      const actionLink = `${appUrl}/a/${actionToken}`;

      await this.smsOrchestrator.sendOrderSMS({
        sellerId: targetSeller.id,
        orderId: createdOrder.id,
        recipientPhone: targetSeller.phone,
        event: "seller_new_order",
        shopName: targetSeller.sms_name || targetSeller.business_name,
        orderNumber: createdOrder.number,
        itemCount: draftData.items.reduce(
          (sum: number, i: any) => sum + i.quantity,
          0
        ),
        totalBirr: draftData.totalSantim / 100,
        link: actionLink,
        async: true,
        throwOnError: false, // Don't abort buyer's confirmed order if outbound carrier SMS fails
      });
    }

    this.logger.log(
      `Order #${createdOrder.number} (${createdOrder.id}) created for seller ${draftData.sellerId} by buyer ${draftData.buyerPhone}`
    );

    return {
      orderNumber: createdOrder.number,
      orderId: createdOrder.id,
      order: {
        id: createdOrder.id,
        sellerId: createdOrder.seller_id,
        customerId: createdOrder.customer_id ?? null,
        number: createdOrder.number,
        buyerName: createdOrder.buyer_name,
        buyerPhone: createdOrder.buyer_phone,
        smsConsent: createdOrder.sms_consent,
        consentWording: createdOrder.consent_wording,
        consentAt: createdOrder.consent_at?.toISOString() ?? null,
        state: createdOrder.state as any,
        totalSantim: createdOrder.total_santim,
        createdAt: createdOrder.created_at.toISOString(),
        items: createdOrder.order_items.map((i: any) => ({
          id: i.id,
          orderId: i.order_id,
          productId: i.product_id,
          nameAtOrder: i.name_at_order,
          unitPriceSantim: i.unit_price_santim,
          quantity: i.quantity,
        })),
      },
    };
  }

  /**
   * Returns authenticated buyer profile for prefilling checkout forms.
   */
  async getBuyerProfile(req: any): Promise<{
    authenticated: boolean;
    customer?: { id: string; name: string; phone: string };
  }> {
    const token = extractBuyerTokenFromRequest(req);
    if (!token) {
      return { authenticated: false };
    }

    const session = await verifyBuyerToken(token);
    if (!session?.phone) {
      return { authenticated: false };
    }

    if (typeof this.prisma.customer?.findUnique !== "function") {
      return { authenticated: false };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { phone: session.phone },
    });

    if (!customer || !customer.phone_verified_at) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },
    };
  }
}
