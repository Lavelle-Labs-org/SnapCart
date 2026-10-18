import crypto from "crypto";

/**
 * Generates an unguessable 16-byte (128-bit) URL-safe action token (22 characters).
 * FR-21 & Section 9.1
 */
export function generateActionToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Computes SHA-256 hash of an action token to store in database.
 * The plaintext token is never stored in DB.
 */
export function hashActionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a 4-digit numeric pickup code (1000 - 9999).
 * Section 9.2
 */
export function generatePickupCode(): string {
  return crypto.randomInt(1000, 10000).toString();
}

/**
 * Hashes a 4-digit pickup code using HMAC-SHA256 with a secret key.
 * Never stores plain codes in the database.
 */
export function hashPickupCode(code: string, secret?: string): string {
  const secretKey = secret || process.env.PICKUP_CODE_SECRET || "fallback_default_pickup_secret_key_32chars";
  return crypto.createHmac("sha256", secretKey).update(code.trim()).digest("hex");
}

/**
 * Constant-time comparison for pickup codes to prevent timing attacks.
 */
export function verifyPickupCodeHash(inputCode: string, storedHash: string, secret?: string): boolean {
  const inputHash = hashPickupCode(inputCode, secret);
  try {
    const a = Buffer.from(inputHash, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verifies SMSHub webhook signature: t={timestamp},v1={hex_hmac}
 * Section 8.4
 */
export function verifySMSHubWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  signingSecret?: string
): { isValid: boolean; error?: string } {
  const secret = signingSecret || process.env.SMSHUB_WEBHOOK_SECRET;
  if (!secret) {
    return { isValid: false, error: "Missing SMSHUB_WEBHOOK_SECRET" };
  }

  if (!signatureHeader) {
    return { isValid: false, error: "Missing X-SMSHub-Signature header" };
  }

  // Parse header: t=...,v1=...
  const parts = signatureHeader.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));

  if (!tPart || !v1Part) {
    return { isValid: false, error: "Malformed X-SMSHub-Signature format" };
  }

  const timestamp = parseInt(tPart.slice(2), 10);
  const v1 = v1Part.slice(3);

  if (isNaN(timestamp)) {
    return { isValid: false, error: "Invalid timestamp in signature header" };
  }

  // Timestamp freshness: must be within 300 seconds (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    return { isValid: false, error: "Webhook timestamp expired (older than 5 minutes)" };
  }

  const expectedData = `${timestamp}.${rawBody}`;
  const expectedHash = crypto.createHmac("sha256", secret).update(expectedData).digest("hex");

  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expectedHash, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { isValid: false, error: "Webhook HMAC signature mismatch" };
    }
  } catch {
    return { isValid: false, error: "Webhook signature comparison error" };
  }

  return { isValid: true };
}
