import { describe, it, expect } from "vitest";
import {
  SMS_TEMPLATES,
  detectEncoding,
  getMaxCharacters,
  truncateShopName,
} from "../templates";

describe("SMS Templates & Encoding (apps/api - MIG-005)", () => {
  describe("detectEncoding", () => {
    it("detects pure GSM-7 characters as GSM-7", () => {
      const text = "Hello from Habesha Cafe! Your order #1001 is ready. 12345.";
      expect(detectEncoding(text)).toBe("GSM-7");
    });

    it("detects Amharic characters as UCS-2", () => {
      const text = "ሰላም ከሀበሻ ካፌ";
      expect(detectEncoding(text)).toBe("UCS-2");
    });

    it("detects emoji as UCS-2", () => {
      const text = "Order ready! ☕";
      expect(detectEncoding(text)).toBe("UCS-2");
    });
  });

  describe("getMaxCharacters", () => {
    it("returns 160 for GSM-7 and 70 for UCS-2", () => {
      expect(getMaxCharacters("GSM-7")).toBe(160);
      expect(getMaxCharacters("UCS-2")).toBe(70);
    });
  });

  describe("truncateShopName", () => {
    it("truncates shop names exceeding 20 characters", () => {
      const longName = "Habesha Traditional Coffee Roastery & Pastry Shop";
      const truncated = truncateShopName(longName, 20);
      expect(truncated).toHaveLength(20);
      expect(truncated).toBe("Habesha Traditional ");
    });

    it("preserves shop names within 20 characters", () => {
      expect(truncateShopName("Habesha Cafe")).toBe("Habesha Cafe");
    });

    it("defaults to 'Shop' when name is empty", () => {
      expect(truncateShopName("")).toBe("Shop");
    });
  });

  describe("SMS_TEMPLATES rendering", () => {
    it("renders sellerNewOrder template correctly", () => {
      const rendered = SMS_TEMPLATES.sellerNewOrder({
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        itemCount: 2,
        totalBirr: 250,
        link: "https://ord.et/a/tok123",
      });
      expect(rendered).toBe("New order #1001: 2 items, 250 birr. Open: https://ord.et/a/tok123");
    });

    it("renders buyerAccepted template correctly", () => {
      const rendered = SMS_TEMPLATES.buyerAccepted({
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        link: "https://ord.et/x/optout123",
      });
      expect(rendered).toBe("Habesha Cafe: order #1001 accepted. We will text when ready. Stop texts: https://ord.et/x/optout123");
    });

    it("renders buyerReady template correctly", () => {
      const rendered = SMS_TEMPLATES.buyerReady({
        shopName: "Habesha Cafe",
        orderNumber: 1001,
        code: "4821",
      });
      expect(rendered).toBe("Habesha Cafe: order #1001 is ready. Pickup code: 4821. Show it when you collect.");
    });
  });
});
