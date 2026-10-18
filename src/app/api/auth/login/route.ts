import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeEthiopianPhone } from "@/lib/phone";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, createSessionCookie } from "@/services/auth";

const loginSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(1, "Password is required"),
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

    const parseResult = loginSchema.safeParse(body);
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

    const { phone, password } = parseResult.data;

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

    // Look up seller by normalized Ethiopian phone
    const seller = await db.seller.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!seller) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid phone number or password",
          },
        },
        { status: 401 }
      );
    }

    // Verify password hash with bcryptjs
    const passwordMatch = await verifyPassword(password, seller.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid phone number or password",
          },
        },
        { status: 401 }
      );
    }

    // Guard: Seller must have verified their phone number (FR-2)
    if (!seller.phone_verified_at) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PHONE_NOT_VERIFIED",
            message: "Phone number has not been verified yet. Please complete phone verification.",
          },
        },
        { status: 403 }
      );
    }

    // Create session token and secure cookie
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
          message: err?.message || "Failed to sign in",
        },
      },
      { status: 500 }
    );
  }
}
