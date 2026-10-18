import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEthiopianPhone } from "@/lib/phone";
import { smshub } from "@/lib/smshub";
import { createSessionToken, createSessionCookie } from "@/services/auth";

const verifyPhoneSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  code: z.string().length(6, "Verification code must be exactly 6 digits"),
});

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

    const parseResult = verifyPhoneSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.errors[0]?.message || "Invalid input data",
          },
        },
        { status: 400 }
      );
    }

    const { phone, code } = parseResult.data;

    const phoneValidation = normalizeEthiopianPhone(phone);
    if (!phoneValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_PHONE",
            message: phoneValidation.error || "Invalid Ethiopian phone number",
          },
        },
        { status: 400 }
      );
    }

    const normalizedPhone = phoneValidation.normalized;

    // Retrieve pending phone verification request
    const verification = await db.phoneVerification.findFirst({
      where: {
        phone: normalizedPhone,
        purpose: "seller_signup",
        status: "pending",
      },
      orderBy: { last_sent_at: "desc" },
    });

    if (!verification) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_PENDING_VERIFICATION",
            message: "No pending verification code found for this phone number",
          },
        },
        { status: 400 }
      );
    }

    // Check code with SMSHub Verify API
    let checkRes;
    try {
      checkRes = await smshub.verifyCheck(verification.verification_id, code);
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VERIFICATION_SERVICE_ERROR",
            message: err?.message || "Failed to contact SMSHub verification service",
          },
        },
        { status: 502 }
      );
    }

    if (!checkRes.data?.valid || checkRes.data?.verification_status !== "approved") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CODE",
            message: "Invalid or expired verification code. Please check and try again.",
          },
        },
        { status: 400 }
      );
    }

    // Mark verification as approved
    await db.phoneVerification.update({
      where: { id: verification.id },
      data: { status: "approved" },
    });

    // Mark seller as phone verified
    const seller = await db.seller.update({
      where: { phone: normalizedPhone },
      data: { phone_verified_at: new Date() },
    });

    // Automatically establish authenticated session for the verified seller
    const token = await createSessionToken({ sellerId: seller.id });
    const cookie = createSessionCookie(token);

    const response = NextResponse.json({
      success: true,
      data: {
        seller: {
          id: seller.id,
          business_name: seller.business_name,
          phone: seller.phone,
          slug: seller.slug,
          phone_verified_at: seller.phone_verified_at,
        },
      },
    });

    response.cookies.set(cookie);
    return response;
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err?.message || "Failed to verify phone number",
        },
      },
      { status: 500 }
    );
  }
}
