import {
  Injectable,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { SignJWT, jwtVerify } from "jose";
import { PrismaService } from "../../prisma/prisma.service";
import { SMSHubService } from "../smshub/smshub.service";
import { env } from "../../config/env";
import { hashPassword, verifyPassword } from "./password";
import { normalizeEthiopianPhone, maskPhoneNumber, SellerDto } from "@order-by-sms/contracts";
import {
  checkPhoneRateLimit,
  checkIpRateLimit,
  enforceRateLimit,
  consumeRateLimit,
  getRateLimitConfig,
} from "../../lib/rate-limit";
import { StorageService } from "../storage/storage.service";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  SessionPayload,
  SessionCookieOptions,
  SignupDto,
  signupSchema,
  VerifyPhoneDto,
  verifyPhoneSchema,
  LoginDto,
  loginSchema,
  UpdateSettingsDto,
  updateSettingsSchema,
  ChangePasswordDto,
  changePasswordSchema,
} from "./auth.types";

function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `shop-${Date.now()}`;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SMSHubService)
    private readonly smshub: SMSHubService,
    @Inject(StorageService)
    private readonly storageService: StorageService
  ) {}

  private getSessionSecretKey(secret?: string): Uint8Array {
    let secretStr = secret;
    if (!secretStr) {
      try {
        secretStr = env.SESSION_SECRET;
      } catch {
        secretStr =
          process.env.SESSION_SECRET ||
          "mock_session_secret_at_least_32_characters_long";
      }
    }
    return new TextEncoder().encode(secretStr);
  }

  async createSessionToken(
    payload: { sellerId: string },
    options?: {
      expiresIn?: string | number;
      secret?: string;
    }
  ): Promise<string> {
    const rawId = payload?.sellerId;
    const sellerId = typeof rawId === "string" ? rawId.trim() : "";
    if (!sellerId) {
      throw new HttpException(
        {
          code: "INVALID_SELLER_ID",
          message:
            "Cannot create session token: sellerId must be a non-empty string",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const secretKey = this.getSessionSecretKey(options?.secret);
    const expiration = options?.expiresIn ?? "7d";

    return await new SignJWT({ sellerId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(secretKey);
  }

  async verifySessionToken(
    token: string,
    options?: { secret?: string }
  ): Promise<SessionPayload> {
    if (!token || typeof token !== "string" || token.trim() === "") {
      throw new HttpException(
        {
          code: "INVALID_TOKEN",
          message: "Missing or invalid session token",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const secretKey = this.getSessionSecretKey(options?.secret);

    try {
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ["HS256"],
      });

      const rawSellerId = payload.sellerId;
      const sellerId = typeof rawSellerId === "string" ? rawSellerId.trim() : "";
      if (!sellerId) {
        throw new HttpException(
          {
            code: "MALFORMED_SESSION",
            message: "Token payload missing valid non-empty sellerId",
          },
          HttpStatus.UNAUTHORIZED
        );
      }

      return {
        sellerId,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      if (err?.code === "ERR_JWT_EXPIRED" || err?.name === "JWTExpired") {
        throw new HttpException(
          {
            code: "SESSION_EXPIRED",
            message: "Session has expired",
          },
          HttpStatus.UNAUTHORIZED
        );
      }
      throw new HttpException(
        {
          code: "INVALID_SIGNATURE",
          message: err?.message || "Invalid session signature",
        },
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  createSessionCookie(
    token: string,
    options?: {
      isProduction?: boolean;
      maxAge?: number;
    }
  ): SessionCookieOptions {
    const isProd =
      options?.isProduction ?? process.env.NODE_ENV === "production";

    return {
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: options?.maxAge ?? SESSION_DURATION_SECONDS,
    };
  }

  createClearSessionCookie(): SessionCookieOptions {
    return {
      name: SESSION_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    };
  }

  async signup(dto: SignupDto, clientIp?: string) {
    if (clientIp) {
      await enforceRateLimit(
        checkIpRateLimit(this.prisma, clientIp),
        "Too many signup attempts from this IP address. Please try again later."
      );
    }

    const parseResult = signupSchema.safeParse(dto);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message:
            ((parseResult.error as any).issues?.[0]?.message ||
              (parseResult.error as any).errors?.[0]?.message) ||
            "Invalid input data",
          details: parseResult.error.flatten().fieldErrors,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { business_name, sms_name, phone, password } = parseResult.data;

    const phoneValidation = normalizeEthiopianPhone(phone);
    if (!phoneValidation.isValid) {
      throw new HttpException(
        {
          code: "INVALID_PHONE",
          message: phoneValidation.error || "Invalid Ethiopian mobile number",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const normalizedPhone = phoneValidation.normalized;

    await enforceRateLimit(
      checkPhoneRateLimit(this.prisma, normalizedPhone),
      "Too many signup attempts for this phone number. Please try again later."
    );

    const existingSeller = await this.prisma.seller.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingSeller) {
      throw new HttpException(
        {
          code: "PHONE_ALREADY_EXISTS",
          message: "A seller with this phone number is already registered",
        },
        HttpStatus.CONFLICT
      );
    }

    const baseSlug = slugify(business_name);
    let finalSlug = baseSlug;
    let counter = 1;
    while (await this.prisma.seller.findUnique({ where: { slug: finalSlug } })) {
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
    }

    const password_hash = await hashPassword(password);

    let verifyRes;
    try {
      verifyRes = await this.smshub.verifySend(
        normalizedPhone,
        sms_name.trim(),
        6,
        300
      );
    } catch (err: any) {
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

    const verificationId = verifyRes.data.verification_id;

    const initialCredits = process.env.FREE_TRIAL_SMS_CREDITS
      ? parseInt(process.env.FREE_TRIAL_SMS_CREDITS, 10)
      : 10;

    const seller = await this.prisma.seller.create({
      data: {
        business_name: business_name.trim(),
        sms_name: sms_name.trim(),
        phone: normalizedPhone,
        password_hash,
        slug: finalSlug,
        phone_verified_at: null,
        sms_credits: isNaN(initialCredits) ? 10 : initialCredits,
        sms_credits_used: 0,
      },
    });

    await this.prisma.phoneVerification.create({
      data: {
        phone: normalizedPhone,
        purpose: "seller_signup",
        verification_id: verificationId,
        status: "pending",
        expires_at: new Date(Date.now() + getRateLimitConfig().otpExpiry * 1000),
        last_sent_at: new Date(),
      },
    });

    return {
      seller_id: seller.id,
      phone: seller.phone,
      slug: seller.slug,
      verification_id: verificationId,
      message: `Verification code sent to ${maskPhoneNumber(seller.phone)}`,
    };
  }

  async verifyPhone(dto: VerifyPhoneDto) {
    const parseResult = verifyPhoneSchema.safeParse(dto);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message:
            ((parseResult.error as any).issues?.[0]?.message ||
              (parseResult.error as any).errors?.[0]?.message) ||
            "Invalid input data",
          details: parseResult.error.flatten().fieldErrors,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { phone, code } = parseResult.data;

    const phoneValidation = normalizeEthiopianPhone(phone);
    if (!phoneValidation.isValid) {
      throw new HttpException(
        {
          code: "INVALID_PHONE",
          message: phoneValidation.error || "Invalid Ethiopian phone number",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const normalizedPhone = phoneValidation.normalized;

    const verification = await this.prisma.phoneVerification.findFirst({
      where: {
        phone: normalizedPhone,
        purpose: "seller_signup",
        status: "pending",
      },
      orderBy: { last_sent_at: "desc" },
    });

    if (!verification) {
      throw new HttpException(
        {
          code: "NO_PENDING_VERIFICATION",
          message: "No pending verification code found for this phone number",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    let checkRes;
    try {
      checkRes = await this.smshub.verifyCheck(
        verification.verification_id,
        code
      );
    } catch (err: any) {
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

    await this.prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { status: "approved" },
    });

    const seller = await this.prisma.seller.update({
      where: { phone: normalizedPhone },
      data: { phone_verified_at: new Date() },
    });

    const token = await this.createSessionToken({ sellerId: seller.id });
    const cookie = this.createSessionCookie(token);

    return {
      seller: {
        id: seller.id,
        business_name: seller.business_name,
        phone: seller.phone,
        slug: seller.slug,
        phone_verified_at: seller.phone_verified_at,
      },
      token,
      cookie,
    };
  }

  async login(dto: LoginDto, clientIp?: string) {
    if (clientIp) {
      await enforceRateLimit(
        checkIpRateLimit(this.prisma, clientIp),
        "Too many login attempts from this IP address. Please try again later."
      );
    }

    const parseResult = loginSchema.safeParse(dto);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message:
            ((parseResult.error as any).issues?.[0]?.message ||
              (parseResult.error as any).errors?.[0]?.message) ||
            "Invalid input data",
          details: parseResult.error.flatten().fieldErrors,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { phone, password } = parseResult.data;

    const phoneValidation = normalizeEthiopianPhone(phone);
    if (!phoneValidation.isValid) {
      throw new HttpException(
        {
          code: "INVALID_PHONE",
          message: phoneValidation.error || "Invalid Ethiopian phone number",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const normalizedPhone = phoneValidation.normalized;

    const seller = await this.prisma.seller.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!seller) {
      throw new HttpException(
        {
          code: "INVALID_CREDENTIALS",
          message: "Invalid phone number or password",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const passwordMatch = await verifyPassword(password, seller.password_hash);
    if (!passwordMatch) {
      throw new HttpException(
        {
          code: "INVALID_CREDENTIALS",
          message: "Invalid phone number or password",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    if (!seller.phone_verified_at) {
      throw new HttpException(
        {
          code: "PHONE_NOT_VERIFIED",
          message:
            "Phone number has not been verified yet. Please complete phone verification.",
        },
        HttpStatus.FORBIDDEN
      );
    }

    const token = await this.createSessionToken({ sellerId: seller.id });
    const cookie = this.createSessionCookie(token);

    return {
      seller: {
        id: seller.id,
        business_name: seller.business_name,
        phone: seller.phone,
        slug: seller.slug,
      },
      token,
      cookie,
    };
  }

  async getSellerById(sellerId: string) {
    return this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
  }

  async updateSettings(sellerId: string, dto: UpdateSettingsDto) {
    const parseResult = updateSettingsSchema.safeParse(dto);
    if (!parseResult.success) {
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message:
            ((parseResult.error as any).issues?.[0]?.message ||
              (parseResult.error as any).errors?.[0]?.message) ||
            "Invalid input data",
          details: parseResult.error.flatten().fieldErrors,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const business_name = parseResult.data.business_name ?? parseResult.data.businessName;
    const sms_name = parseResult.data.sms_name ?? parseResult.data.smsName;
    const dataToUpdate: { business_name?: string; sms_name?: string } = {};

    if (business_name !== undefined) {
      dataToUpdate.business_name = business_name;
    }
    if (sms_name !== undefined) {
      dataToUpdate.sms_name = sms_name;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new HttpException(
        {
          code: "NO_UPDATES_PROVIDED",
          message: "At least one setting field (business_name or sms_name) must be provided",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const updatedSeller = await this.prisma.seller.update({
      where: { id: sellerId },
      data: dataToUpdate,
    });

    return {
      seller: {
        id: updatedSeller.id,
        businessName: updatedSeller.business_name,
        smsName: updatedSeller.sms_name,
        phone: updatedSeller.phone,
        slug: updatedSeller.slug,
        phoneVerifiedAt: updatedSeller.phone_verified_at?.toISOString() ?? null,
        logoUrl: updatedSeller.logo_url ?? null,
        logo_url: updatedSeller.logo_url ?? null,
        createdAt: updatedSeller.created_at.toISOString(),
      },
    };
  }

  /**
   * Uploads and saves a storefront profile picture to Cloudflare R2 or local storage.
   */
  async uploadProfileImage(
    sellerId: string,
    buffer: Buffer,
    originalName: string
  ): Promise<{ seller: SellerDto }> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: "Seller not found",
        },
        HttpStatus.NOT_FOUND
      );
    }

    // Configurable rate limit matching product image uploads (default 30 uploads / hour per seller)
    const maxUploads = parseInt(
      process.env.RATE_LIMIT_IMAGE_UPLOADS_MAX ||
        process.env.RATE_LIMIT_PROFILE_UPLOADS_MAX ||
        "30",
      10
    );
    const windowSeconds = parseInt(
      process.env.RATE_LIMIT_IMAGE_UPLOADS_WINDOW_SECONDS ||
        process.env.RATE_LIMIT_PROFILE_UPLOADS_WINDOW_SECONDS ||
        "3600",
      10
    );

    const rateLimit = await consumeRateLimit(this.prisma, {
      key: `rate:profile:${sellerId}`,
      limit: maxUploads,
      windowSeconds,
    });
    enforceRateLimit(
      rateLimit,
      "Profile image upload rate limit exceeded. Please wait before uploading another photo."
    );

    const uploadResult = await this.storageService.uploadStoreProfileImage({
      buffer,
      originalName,
      sellerId,
    });

    // Delete old profile picture if exists
    if (seller.logo_url) {
      await this.storageService.deleteStoreProfileImage(seller.logo_url);
    }

    const updatedSeller = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        logo_url: uploadResult.imageUrl,
      },
    });

    return {
      seller: {
        id: updatedSeller.id,
        businessName: updatedSeller.business_name,
        smsName: updatedSeller.sms_name,
        phone: updatedSeller.phone,
        slug: updatedSeller.slug,
        phoneVerifiedAt: updatedSeller.phone_verified_at?.toISOString() ?? null,
        logoUrl: updatedSeller.logo_url ?? null,
        logo_url: updatedSeller.logo_url ?? null,
        createdAt: updatedSeller.created_at.toISOString(),
      },
    };
  }

  /**
   * Deletes a storefront profile picture.
   */
  async deleteProfileImage(sellerId: string): Promise<{ seller: SellerDto }> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: "Seller not found",
        },
        HttpStatus.NOT_FOUND
      );
    }

    if (seller.logo_url) {
      await this.storageService.deleteStoreProfileImage(seller.logo_url);
    }

    const updatedSeller = await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        logo_url: null,
      },
    });

    return {
      seller: {
        id: updatedSeller.id,
        businessName: updatedSeller.business_name,
        smsName: updatedSeller.sms_name,
        phone: updatedSeller.phone,
        slug: updatedSeller.slug,
        phoneVerifiedAt: updatedSeller.phone_verified_at?.toISOString() ?? null,
        logoUrl: null,
        logo_url: null,
        createdAt: updatedSeller.created_at.toISOString(),
      },
    };
  }

  /**
   * Updates a seller's password after verifying their current password.
   */
  async changePassword(
    sellerId: string,
    dto: ChangePasswordDto
  ): Promise<{ success: boolean; message: string }> {
    if (!sellerId) {
      throw new HttpException(
        {
          code: "UNAUTHORIZED",
          message: "Seller identification required",
        },
        HttpStatus.UNAUTHORIZED
      );
    }

    const parseResult = changePasswordSchema.safeParse(dto);
    if (!parseResult.success) {
      const firstError =
        (parseResult.error as any).issues?.[0]?.message ||
        (parseResult.error as any).errors?.[0]?.message ||
        "Invalid password input";
      throw new HttpException(
        {
          code: "VALIDATION_ERROR",
          message: firstError,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const { currentPassword, newPassword } = parseResult.data;

    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });

    if (!seller) {
      throw new HttpException(
        {
          code: "NOT_FOUND",
          message: "Seller not found",
        },
        HttpStatus.NOT_FOUND
      );
    }

    const passwordMatch = await verifyPassword(currentPassword, seller.password_hash);
    if (!passwordMatch) {
      throw new HttpException(
        {
          code: "INVALID_CURRENT_PASSWORD",
          message: "Current password is incorrect",
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await this.prisma.seller.update({
      where: { id: sellerId },
      data: {
        password_hash: newPasswordHash,
      },
    });

    return {
      success: true,
      message: "Password updated successfully",
    };
  }
}
