/**
 * SMS Templates, Encoding Analysis & Character Counting
 * Section 7 & FR-25
 * apps/api/src/modules/smshub/templates.ts
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

export const SMS_TEMPLATES = {
  sellerNewOrder: (opts: RenderTemplateOptions) => {
    return `New order #${opts.orderNumber}: ${opts.itemCount ?? 0} items, ${opts.totalBirr ?? 0} birr. Open: ${opts.link}`;
  },

  buyerAccepted: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: order #${opts.orderNumber} accepted. We will text when ready. Stop texts: ${opts.link}`;
  },

  buyerRejected: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: sorry, your order #${opts.orderNumber} was not accepted. Please contact the seller.`;
  },

  buyerReady: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: order #${opts.orderNumber} is ready. Pickup code: ${opts.code}. Show it when you collect.`;
  },

  buyerNewPickupCode: (opts: RenderTemplateOptions) => {
    const shop = truncateShopName(opts.shopName);
    return `${shop}: new pickup code for order #${opts.orderNumber} is ${opts.code}.`;
  },
};
