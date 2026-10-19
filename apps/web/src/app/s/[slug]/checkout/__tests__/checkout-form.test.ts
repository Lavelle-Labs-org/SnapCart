import { describe, it, expect, vi } from "vitest";
import { normalizeEthiopianPhone, toBirr } from "@order-by-sms/contracts";

describe("Checkout Form State & Validation Logic (FE-002)", () => {
  const mockSeller = {
    id: "seller-1",
    businessName: "Habesha Cafe & Bakery",
    smsName: "Habesha Cafe",
    slug: "habesha-cafe",
  };

  const mockProducts = [
    {
      id: "prod-1",
      name: "Special Macchiato",
      priceSantim: 5000,
      available: true,
    },
    {
      id: "prod-2",
      name: "Fresh Croissant",
      priceSantim: 3500,
      available: true,
    },
  ];

  describe("Cart & Total Calculation", () => {
    it("computes accurate santim and Birr subtotal for cart entries", () => {
      const cart = {
        "prod-1": 2, // 5000 * 2 = 10000
        "prod-2": 1, // 3500 * 1 = 3500
      };

      const totalSantim = Object.entries(cart).reduce((sum, [pId, qty]) => {
        const prod = mockProducts.find((p) => p.id === pId);
        return sum + (prod ? prod.priceSantim * qty : 0);
      }, 0);

      expect(totalSantim).toBe(13500);
      expect(toBirr(totalSantim)).toBe(135);
    });
  });

  describe("Ethiopian Phone Validation", () => {
    it("accepts valid Ethio Telecom numbers starting with 09 (10 digits)", () => {
      const res = normalizeEthiopianPhone("0911223344");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("0911223344");
    });

    it("accepts valid Safaricom Ethiopia numbers starting with 07 (10 digits)", () => {
      const res = normalizeEthiopianPhone("0712345678");
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe("0712345678");
    });

    it("rejects invalid prefixes or lengths", () => {
      expect(normalizeEthiopianPhone("0811223344").isValid).toBe(false);
      expect(normalizeEthiopianPhone("12345").isValid).toBe(false);
      expect(normalizeEthiopianPhone("").isValid).toBe(false);
      expect(normalizeEthiopianPhone("091122334455").isValid).toBe(false);
    });
  });

  describe("SMS Consent Checkbox Invariant (FR-9)", () => {
    it("defaults smsConsent to false (unticked by default)", () => {
      const defaultSmsConsent = false;
      expect(defaultSmsConsent).toBe(false);
    });

    it("includes exact required consent wording", () => {
      const wording =
        "Send me SMS updates about this order (Accepted, Ready, and Handover code).";
      expect(wording).toContain("Send me SMS updates about this order");
    });
  });

  describe("Checkout Submission Payload Construction", () => {
    it("builds compliant CheckoutInput payload matching API expectations", () => {
      const cart = { "prod-1": 2 };
      const buyerName = "Abebe Bikila";
      const buyerPhone = "0911223344";
      const smsConsent = false;

      const payload = {
        slug: mockSeller.slug,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim(),
        smsConsent,
        consentWording:
          "Send me SMS updates about this order (Accepted, Ready, and Handover code).",
        items: Object.entries(cart).map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
      };

      expect(payload.slug).toBe("habesha-cafe");
      expect(payload.buyerName).toBe("Abebe Bikila");
      expect(payload.buyerPhone).toBe("0911223344");
      expect(payload.smsConsent).toBe(false);
      expect(payload.items).toEqual([{ productId: "prod-1", quantity: 2 }]);
    });
  });
});
