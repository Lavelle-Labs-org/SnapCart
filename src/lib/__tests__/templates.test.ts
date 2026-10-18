import { describe, it, expect } from "vitest";
import {
  detectEncoding,
  getMaxCharacters,
  truncateShopName,
  SMS_TEMPLATES,
  RenderTemplateOptions,
} from "@/lib/templates";

describe("SMS Templates & Encoding Verification (BE-002, FR-25)", () => {
  // Worst-case parameter specifications from docs/04
  const worstCaseOptions: RenderTemplateOptions = {
    shopName: "12345678901234567890", // exactly 20 characters
    orderNumber: 9999, // 4-digit order number
    itemCount: 99,
    totalBirr: 99999,
    link: "https://ord.et/x/1234567890123456789012", // 39-character link
    code: "9999", // 4-digit pickup code
  };

  const typicalOptions: RenderTemplateOptions = {
    shopName: "Habesha Cafe",
    orderNumber: 1043,
    itemCount: 3,
    totalBirr: 850,
    link: "https://ord.et/x/Z7y1m2NbQpRtUvWxYz1234",
    code: "4821",
  };

  describe("detectEncoding", () => {
    it("detects standard English ASCII as GSM-7", () => {
      expect(detectEncoding("Hello World! 12345")).toBe("GSM-7");
      expect(detectEncoding("New order #1043: 3 items, 850 birr.")).toBe("GSM-7");
    });

    it("detects smart / curly quotes as UCS-2", () => {
      // Smart single quote: ’
      expect(detectEncoding("Habesha Cafe’s order")).toBe("UCS-2");
      // Smart double quote: “ ”
      expect(detectEncoding('“Order ready”')).toBe("UCS-2");
    });

    it("detects emojis as UCS-2", () => {
      expect(detectEncoding("Order is ready! ☕")).toBe("UCS-2");
      expect(detectEncoding("Habesha Cafe 🎉")).toBe("UCS-2");
    });

    it("detects Amharic Ge'ez script as UCS-2", () => {
      expect(detectEncoding("ትዕዛዝዎ ተቀብሏል")).toBe("UCS-2");
      expect(detectEncoding("አዲስ የመረከቢያ ኮድ")).toBe("UCS-2");
    });
  });

  describe("getMaxCharacters", () => {
    it("returns 160 for GSM-7 and 70 for UCS-2", () => {
      expect(getMaxCharacters("GSM-7")).toBe(160);
      expect(getMaxCharacters("UCS-2")).toBe(70);
    });
  });

  describe("truncateShopName", () => {
    it("truncates names longer than 20 characters", () => {
      const longName = "Habesha Traditional Cafe & Pastry Shop";
      const truncated = truncateShopName(longName);
      expect(truncated.length).toBe(20);
      expect(truncated).toBe("Habesha Traditional ");
    });

    it("preserves names 20 characters or shorter", () => {
      expect(truncateShopName("Habesha Cafe")).toBe("Habesha Cafe");
      expect(truncateShopName("12345678901234567890")).toBe("12345678901234567890");
    });

    it("returns fallback 'Shop' for empty or missing name", () => {
      expect(truncateShopName("")).toBe("Shop");
    });
  });

  describe("English Templates GSM-7 & Length Invariants", () => {
    const templates = [
      { name: "sellerNewOrder", fn: SMS_TEMPLATES.sellerNewOrder },
      { name: "buyerAccepted", fn: SMS_TEMPLATES.buyerAccepted },
      { name: "buyerRejected", fn: SMS_TEMPLATES.buyerRejected },
      { name: "buyerReady", fn: SMS_TEMPLATES.buyerReady },
      { name: "buyerNewPickupCode", fn: SMS_TEMPLATES.buyerNewPickupCode },
    ];

    it("verifies all 5 English templates evaluate to GSM-7 encoding", () => {
      for (const t of templates) {
        const text = t.fn(typicalOptions);
        const encoding = detectEncoding(text);
        expect(encoding, `Template ${t.name} must evaluate to GSM-7`).toBe("GSM-7");
      }
    });

    it("verifies all 5 English templates stay <= 120 characters with worst-case parameters", () => {
      for (const t of templates) {
        const text = t.fn(worstCaseOptions);
        const length = text.length;
        expect(
          length,
          `Template ${t.name} with worst-case parameters was ${length} chars, must be <= 120`
        ).toBeLessThanOrEqual(120);

        // Also confirm it evaluates to GSM-7 with worst-case parameters
        expect(detectEncoding(text)).toBe("GSM-7");
      }
    });

    it("guarantees message + 25-character default SMSHub signature fits in 160-char GSM-7 segment", () => {
      const DEFAULT_SIGNATURE_LENGTH = 25; // per docs/04 Section 3
      const SEPARATOR_LENGTH = 2; // blank line "\n\n"

      for (const t of templates) {
        const text = t.fn(worstCaseOptions);
        const totalLength = text.length + SEPARATOR_LENGTH + DEFAULT_SIGNATURE_LENGTH;
        expect(
          totalLength,
          `Template ${t.name} with signature (${totalLength} chars) exceeds 160 char GSM-7 limit`
        ).toBeLessThanOrEqual(160);
      }
    });
  });
});
