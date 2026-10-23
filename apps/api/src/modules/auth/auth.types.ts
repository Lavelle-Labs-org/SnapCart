import { z } from "zod";
import type { Seller } from "@prisma/client";

export const SESSION_COOKIE_NAME = "seller_session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  sellerId: string;
  iat?: number;
  exp?: number;
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
}

export interface AuthenticatedSeller {
  sellerId: string;
  seller?: Seller;
  phone?: string;
  slug?: string;
}

export const signupSchema = z.object({
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

export type SignupDto = z.infer<typeof signupSchema>;

export const verifyPhoneSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  code: z.string().length(6, "Verification code must be exactly 6 digits"),
});

export type VerifyPhoneDto = z.infer<typeof verifyPhoneSchema>;

export const loginSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const updateSettingsSchema = z.object({
  business_name: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name cannot exceed 100 characters")
    .optional(),
  sms_name: z
    .string()
    .trim()
    .min(2, "SMS name must be at least 2 characters")
    .max(20, "SMS name cannot exceed 20 characters")
    .optional(),
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name cannot exceed 100 characters")
    .optional(),
  smsName: z
    .string()
    .trim()
    .min(2, "SMS name must be at least 2 characters")
    .max(20, "SMS name cannot exceed 20 characters")
    .optional(),
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

export function serializeCookie(options: SessionCookieOptions): string {
  const parts = [
    `${options.name}=${encodeURIComponent(options.value)}`,
    `Path=${options.path || "/"}`,
    `Max-Age=${options.maxAge}`,
    options.httpOnly ? "HttpOnly" : "",
    options.secure ? "Secure" : "",
    `SameSite=${options.sameSite ? options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1) : "Lax"}`,
  ].filter(Boolean);
  return parts.join("; ");
}
