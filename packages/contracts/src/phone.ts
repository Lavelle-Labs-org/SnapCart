/**
 * Ethiopian phone number utilities.
 * FR-3: Phone numbers are accepted as 09..., 07..., 251..., or +251...,
 * normalized to canonical 09... or 07... format, and rejected if international or invalid.
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  network?: "ethio_telecom" | "safaricom";
  error?: string;
}

export function normalizeEthiopianPhone(input: string): PhoneValidationResult {
  if (!input || typeof input !== "string") {
    return { isValid: false, normalized: "", error: "Phone number is required." };
  }

  // Remove spaces, hyphens, parentheses, and dots
  let cleaned = input.trim().replace(/[\s\-\(\)\.]/g, "");

  // Handle + prefix
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Handle international prefix 251
  if (cleaned.startsWith("251")) {
    cleaned = "0" + cleaned.slice(3);
  }

  // Validate Ethiopian mobile prefix: 09 (Ethio Telecom) or 07 (Safaricom)
  // Total length must be 10 digits
  if (/^09\d{8}$/.test(cleaned)) {
    return {
      isValid: true,
      normalized: cleaned,
      network: "ethio_telecom",
    };
  }

  if (/^07\d{8}$/.test(cleaned)) {
    return {
      isValid: true,
      normalized: cleaned,
      network: "safaricom",
    };
  }

  return {
    isValid: false,
    normalized: cleaned,
    error: "Invalid Ethiopian mobile number. Must start with 09 (Ethio Telecom) or 07 (Safaricom) with 10 digits.",
  };
}

/**
 * Normalizes an Ethiopian phone number to canonical 10-digit format (09... or 07...).
 * Throws an Error if the phone number is invalid.
 */
export function normalizePhoneNumber(input: string): string {
  const res = normalizeEthiopianPhone(input);
  if (!res.isValid) {
    throw new Error(res.error || `Invalid Ethiopian phone number: ${input}`);
  }
  return res.normalized;
}

/**
 * Masks a phone number for display/logging according to Section 9.4:
 * e.g. "0912345567" -> "09•• ••• 567"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 10) return phone;
  const prefix = phone.slice(0, 2);
  const suffix = phone.slice(-3);
  return `${prefix}•• ••• ${suffix}`;
}
