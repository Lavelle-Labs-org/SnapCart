/**
 * SMS Templates, Encoding Analysis & Segment Calculation
 * apps/api & apps/web shared contracts
 */

export interface RenderTemplateOptions {
  shopName: string;
  orderNumber: number;
  itemCount?: number;
  totalBirr?: number;
  link?: string;
  code?: string;
}

/**
 * Checks if a string contains any non-GSM-7 characters (e.g. Amharic Ge'ez script, emojis, curly quotes)
 */
export function detectEncoding(text: string): "GSM-7" | "UCS-2" {
  // Standard GSM 03.38 basic character set + extension characters regex
  const gsm7Regex =
    /^[@£$¥èéùìòÇ\r\nØø\r\nÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/;
  return gsm7Regex.test(text) ? "GSM-7" : "UCS-2";
}

export function getMaxCharacters(encoding: "GSM-7" | "UCS-2"): number {
  return encoding === "GSM-7" ? 160 : 70;
}

export function truncateShopName(name: string, maxLen: number = 20): string {
  if (!name) return "Shop";
  const trimmed = name.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

export interface SmsSegmentAnalysis {
  encoding: "GSM-7" | "UCS-2";
  characterCount: number;
  singleSegmentLimit: number;
  segments: number;
  exceedsSingleSegment: boolean;
  hasNonGsm: boolean;
  remainingInSingleSegment: number;
}

/**
 * Calculates SMS segment count and limits according to telecom standards:
 * - GSM-7: 160 characters for single segment; 153 characters per segment if concatenated.
 * - UCS-2: 70 characters for single segment; 67 characters per segment if concatenated.
 */
export function calculateSmsSegments(text: string): SmsSegmentAnalysis {
  const encoding = detectEncoding(text);
  const characterCount = text.length;
  const singleSegmentLimit = getMaxCharacters(encoding);
  const hasNonGsm = encoding === "UCS-2";

  let segments = 1;
  if (characterCount === 0) {
    segments = 0;
  } else if (encoding === "GSM-7") {
    if (characterCount <= 160) {
      segments = 1;
    } else {
      segments = Math.ceil(characterCount / 153);
    }
  } else {
    // UCS-2
    if (characterCount <= 70) {
      segments = 1;
    } else {
      segments = Math.ceil(characterCount / 67);
    }
  }

  const remainingInSingleSegment = Math.max(0, singleSegmentLimit - characterCount);

  return {
    encoding,
    characterCount,
    singleSegmentLimit,
    segments,
    exceedsSingleSegment: characterCount > singleSegmentLimit,
    hasNonGsm,
    remainingInSingleSegment,
  };
}

export const SMS_TEMPLATES = {
  sellerNewOrder: (opts: RenderTemplateOptions) => {
    return `New order #${opts.orderNumber}: ${opts.itemCount ?? 0} items, ${opts.totalBirr ?? 0} birr. Open: ${opts.link ?? "https://ord.et/a/sample"}`;
  },

  buyerAccepted: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: order #${opts.orderNumber} accepted. We will text when ready. Stop texts: ${opts.link ?? "https://ord.et/x/sample"}`;
  },

  buyerRejected: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: sorry, your order #${opts.orderNumber} was not accepted. Please contact the seller.`;
  },

  buyerReady: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: order #${opts.orderNumber} is ready. Pickup code: ${opts.code ?? "1234"}. Show it when you collect.`;
  },

  buyerNewPickupCode: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: new pickup code for order #${opts.orderNumber} is ${opts.code ?? "5678"}.`;
  },
};
