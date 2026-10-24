import { z } from "zod";
import { createZodDto } from "../../common/pipes/zod-validation.pipe";
import { normalizeEthiopianPhone } from "@order-by-sms/contracts";

export const CheckoutItemSchema = z.object({
  productId: z.string({ message: "Product ID is required" }).min(1),
  quantity: z
    .number({ message: "Quantity is required" })
    .int()
    .min(1, { message: "Quantity must be at least 1" })
    .max(999, { message: "Quantity exceeds maximum allowable quantity" }),
});

export const CheckoutSchema = z
  .object({
    slug: z.string({ message: "Seller slug is required" }).trim().min(1),
    buyerName: z.string().trim().min(1).max(100).optional(),
    buyer_name: z.string().trim().min(1).max(100).optional(),
    buyerPhone: z.string().trim().optional(),
    buyer_phone: z.string().trim().optional(),
    smsConsent: z.boolean().optional(),
    sms_consent: z.boolean().optional(),
    consentWording: z.string().optional(),
    consent_wording: z.string().optional(),
    items: z
      .array(CheckoutItemSchema, { message: "Cart items are required" })
      .min(1, { message: "Cart cannot be empty" }),
  })
  .refine(
    (data) => {
      const name = data.buyerName ?? data.buyer_name;
      return typeof name === "string" && name.trim().length > 0;
    },
    {
      message: "Buyer name is required",
      path: ["buyerName"],
    }
  )
  .refine(
    (data) => {
      const rawPhone = data.buyerPhone ?? data.buyer_phone;
      if (!rawPhone || typeof rawPhone !== "string") return false;
      const res = normalizeEthiopianPhone(rawPhone);
      return res.isValid;
    },
    {
      message:
        "Invalid Ethiopian mobile number. Must start with 09 (Ethio Telecom) or 07 (Safaricom) with 10 digits.",
      path: ["buyerPhone"],
    }
  );

export const ResendCheckoutOtpSchema = z
  .object({
    draftId: z.string().trim().min(1).optional(),
    draft_id: z.string().trim().min(1).optional(),
  })
  .refine((data) => Boolean(data.draftId || data.draft_id), {
    message: "draftId is required",
    path: ["draftId"],
  });

export const VerifyCheckoutSchema = z
  .object({
    draftId: z.string().trim().min(1).optional(),
    draft_id: z.string().trim().min(1).optional(),
    code: z
      .string({ message: "Verification code is required" })
      .trim()
      .min(1, { message: "Verification code cannot be empty" }),
  })
  .refine((data) => Boolean(data.draftId || data.draft_id), {
    message: "draftId is required",
    path: ["draftId"],
  });

export class CheckoutDto extends createZodDto(CheckoutSchema) {}
export class ResendCheckoutOtpDto extends createZodDto(ResendCheckoutOtpSchema) {}
export class VerifyCheckoutDto extends createZodDto(VerifyCheckoutSchema) {}
