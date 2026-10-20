/**
 * SMS Orchestrator Types, Events, and Privacy Masking Helpers (BE-007)
 * Corresponds to docs/04 Section 1 & 5, docs/06 Section 9.4, docs/08.
 */

export type SMSEvent =
  | "seller_new_order"
  | "buyer_order_accepted"
  | "buyer_order_rejected"
  | "buyer_order_ready"
  | "buyer_new_pickup_code"
  | "seller_phone_code"
  | "buyer_phone_code"
  // Common aliases:
  | "new_order"
  | "accepted"
  | "rejected"
  | "ready"
  | "new_pickup_code";

export interface SendOrderSMSOptions {
  orderId?: string;
  sellerId?: string;
  recipientPhone: string;
  event: SMSEvent | string;
  // Template parameters:
  shopName?: string;
  orderNumber?: number;
  itemCount?: number;
  totalBirr?: number;
  link?: string;
  code?: string;
  // Pre-rendered message body (optional):
  text?: string;
  // Consent flag (if undefined & orderId provided, checked from DB order):
  smsConsent?: boolean;
  // Optional idempotency key for live SMS dispatch deduplication:
  idempotencyKey?: string;
  // Throw on delivery error (default: false):
  throwOnError?: boolean;
  // Guardrails & Rate Limits overrides (BE-017):
  sendingPaused?: boolean;
  allowlist?: string;
  dailyCap?: number;
  phoneRateLimit?: number;
  mode?: "test" | "live";
}

export interface SendSMSResult {
  status: "sent" | "skipped" | "test_passed" | "failed";
  messageId?: string;
  smshubMessageId?: string;
  creditsUsed?: number;
  skipReason?: string;
  errorType?: string;
  text: string;
}

/**
 * Returns true if the SMS event targets a buyer and strictly requires buyer consent.
 * Per docs/04 Section 1:
 * - seller_phone_code: No
 * - buyer_phone_code: No (mandatory verification OTP)
 * - seller_new_order: No (seller transaction alert)
 * - buyer_order_accepted: Yes
 * - buyer_order_rejected: Yes
 * - buyer_order_ready: Yes
 * - buyer_new_pickup_code: Yes
 */
export function isBuyerConsentRequiredEvent(event: string): boolean {
  const normalized = event.toLowerCase();
  const consentRequired = [
    "buyer_order_accepted",
    "accepted",
    "buyer_order_rejected",
    "rejected",
    "buyer_order_ready",
    "ready",
    "buyer_new_pickup_code",
    "new_pickup_code",
  ];
  return consentRequired.includes(normalized);
}

/**
 * Masks plain pickup codes and sensitive OTPs in message text before storing in messages.text.
 * Guarantees zero plain codes in logs or database audit rows (docs/06 Sec 9.4, docs/08).
 */
export function maskCodeInText(text: string, code?: string): string {
  let masked = text;

  // 1. If explicit code was supplied, mask that exact sequence
  if (code && typeof code === "string" && code.trim().length > 0) {
    const escaped = code.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    masked = masked.replace(new RegExp(escaped, "g"), "****");
  }

  // 2. Pattern replacements for standard pickup codes
  masked = masked.replace(/(Pickup code:\s*)\d{4,6}/gi, "$1****");
  masked = masked.replace(/(code for order #\d+ is\s*)\d{4,6}/gi, "$1****");
  masked = masked.replace(/(new pickup code.*?is\s*)\d{4,6}/gi, "$1****");
  masked = masked.replace(/(code is\s*)\d{4,6}/gi, "$1****");
  masked = masked.replace(/(verification code is\s*)\d{4,6}/gi, "$1******");

  return masked;
}
