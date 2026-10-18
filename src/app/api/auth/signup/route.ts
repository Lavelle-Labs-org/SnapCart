import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEthiopianPhone, maskPhoneNumber } from "@/lib/phone";
import { hashPassword } from "@/lib/password";
import { smshub } from "@/lib/smshub";

const signupSchema = z.object({
  business_name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name cannot exceed 100 characters"),
  sms_name: z
    .string()
    .min(2, "SMS name must be at least 2 characters")
    .max(20, "SMS name cannot exceed 20 characters"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(10, "Password must be at least 10 characters long"),
});

function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `shop-${Date.now()}`;
}

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        },
        { status: 400 }
      );
    }

    const parseResult = signupSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid input data",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { business_name, sms_name, phone, password } = parseResult.data;

    // FR-3: Phone normalization and validation
    const phoneValidation = normalizeEthiopianPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PHONE",
            message: phoneValidation.error || "Invalid Ethiopian mobile number",
          },
        },
        { status: 400 }
      );
    }

    const normalizedPhone = phoneValidation.normalized;

    // Check if seller phone is already registered
    const existingSeller = await db.seller.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingSeller) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PHONE_ALREADY_EXISTS",
            message: "A seller with this phone number is already registered",
          },
        },
        { status: 409 }
      );
    }

    // Generate unique slug
    let baseSlug = slugify(business_name);
    let finalSlug = baseSlug;
    let counter = 1;
    while (await db.seller.findUnique({ where: { slug: finalSlug } })) {
      counter++;
      finalSlug = `${baseSlug}-${counter}`;
    }

    // Hash password with bcryptjs (FR-1)
    const password_hash = await hashPassword(password);

    // Dispatch 6-digit phone verification code via SMSHub Verify API (FR-2, FR-11)
    let verifyRes;
    try {
      verifyRes = await smshub.verifySend(normalizedPhone, sms_name.trim(), 6, 300);
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_DISPATCH_FAILED",
            message: err?.message || "Failed to dispatch verification code via SMSHub",
          },
        },
        { status: 502 }
      );
    }

    if (verifyRes.status === "error" || !verifyRes.data?.verification_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "OTP_DISPATCH_FAILED",
            message: verifyRes.message || "SMSHub could not send verification code",
          },
        },
        { status: 502 }
      );
    }

    const verificationId = verifyRes.data.verification_id;

    // Create unverified seller in database
    const seller = await db.seller.create({
      data: {
        business_name: business_name.trim(),
        sms_name: sms_name.trim(),
        phone: normalizedPhone,
        password_hash,
        slug: finalSlug,
        phone_verified_at: null,
      },
    });

    // Record phone verification request
    await db.phoneVerification.create({
      data: {
        phone: normalizedPhone,
        purpose: "seller_signup",
        verification_id: verificationId,
        status: "pending",
        expires_at: new Date(Date.now() + 300 * 1000), // 5 minutes
        last_sent_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        seller_id: seller.id,
        phone: seller.phone,
        slug: seller.slug,
        verification_id: verificationId,
        message: `Verification code sent to ${maskPhoneNumber(seller.phone)}`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err?.message || "Failed to register seller",
        },
      },
      { status: 500 }
    );
  }
}
