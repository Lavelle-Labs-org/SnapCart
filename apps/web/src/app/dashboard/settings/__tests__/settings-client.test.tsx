import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateShopSettings,
  renderTemplatePreview,
  saveSettingsApi,
  getStorefrontUrl,
  TEMPLATE_OPTIONS,
} from "../settings-client";
import SettingsClient from "../settings-client";
import { calculateSmsSegments } from "@order-by-sms/contracts";

// Helper to extract text from JSX element tree
function extractText(node: any): string {
  if (!node) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (node.props?.children) return extractText(node.props.children);
  return "";
}

describe("SettingsClient Logic & Component (FE-013, Issue #36)", () => {
  const mockSeller = {
    id: "seller-101",
    businessName: "Habesha Cafe & Bakery",
    smsName: "Habesha Cafe",
    slug: "habesha-cafe",
    phone: "+251911223344",
  };

  describe("Input Validation & Non-GSM Warning (Acceptance Criterion 1)", () => {
    it("accepts valid business names and SMS names", () => {
      const result = validateShopSettings("Habesha Cafe", "Habesha");
      expect(result.isValid).toBe(true);
      expect(result.hasNonGsm).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("rejects SMS name exceeding 20 characters limit", () => {
      const longSmsName = "Habesha Traditional Bakery"; // 26 chars
      const result = validateShopSettings("Habesha Cafe", longSmsName);
      expect(result.isSmsNameValid).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("SMS name must be between 2 and 20 characters");
    });

    it("rejects SMS name shorter than 2 characters", () => {
      const shortSmsName = "H";
      const result = validateShopSettings("Habesha Cafe", shortSmsName);
      expect(result.isSmsNameValid).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it("detects and flags non-GSM Amharic characters (UCS-2 warning)", () => {
      const amharicSmsName = "ሀበሻ ካፌ";
      const result = validateShopSettings("Habesha Cafe", amharicSmsName);
      expect(result.isValid).toBe(true);
      expect(result.hasNonGsm).toBe(true);
    });

    it("detects and flags emojis in SMS name (UCS-2 warning)", () => {
      const emojiSmsName = "Habesha ☕";
      const result = validateShopSettings("Habesha Cafe", emojiSmsName);
      expect(result.isValid).toBe(true);
      expect(result.hasNonGsm).toBe(true);
    });

    it("detects and flags smart/curly quotes (UCS-2 warning)", () => {
      const curlySmsName = "Sam’s Cafe";
      const result = validateShopSettings("Habesha Cafe", curlySmsName);
      expect(result.isValid).toBe(true);
      expect(result.hasNonGsm).toBe(true);
    });
  });

  describe("Character Counter Reactivity & Segment Estimation (Acceptance Criterion 2)", () => {
    it("reactively calculates character count and 1-segment limit for GSM-7 preview", () => {
      const previewText = renderTemplatePreview("buyerAccepted", "Habesha Cafe");
      expect(previewText).toContain("Habesha Cafe: order #1043 accepted.");

      const analysis = calculateSmsSegments(previewText);
      expect(analysis.encoding).toBe("GSM-7");
      expect(analysis.hasNonGsm).toBe(false);
      expect(analysis.singleSegmentLimit).toBe(160);
      expect(analysis.segments).toBe(1);
      expect(analysis.exceedsSingleSegment).toBe(false);
      expect(analysis.characterCount).toBe(previewText.length);
    });

    it("reactively updates preview when SMS name changes", () => {
      const preview1 = renderTemplatePreview("buyerAccepted", "Alpha");
      const preview2 = renderTemplatePreview("buyerAccepted", "Beta Coffee");

      expect(preview1).toContain("Alpha: order #1043 accepted.");
      expect(preview2).toContain("Beta Coffee: order #1043 accepted.");
      expect(preview2.length).toBeGreaterThan(preview1.length);
    });

    it("reactively converts encoding to UCS-2 and adjusts limit to 70 chars when non-GSM is typed", () => {
      // Shorter template with Amharic that fits within 70 characters
      const amharicPreview = renderTemplatePreview("buyerNewPickupCode", "ሀበሻ");
      expect(amharicPreview).toContain("ሀበሻ: new pickup code");

      const analysis = calculateSmsSegments(amharicPreview);
      expect(analysis.encoding).toBe("UCS-2");
      expect(analysis.hasNonGsm).toBe(true);
      expect(analysis.singleSegmentLimit).toBe(70);
      expect(analysis.segments).toBe(1);
      expect(analysis.exceedsSingleSegment).toBe(false);
    });

    it("estimates 2 segments if message exceeds single-segment limit in UCS-2", () => {
      // Over 70 characters in UCS-2 (85 chars)
      const longUcs2 = renderTemplatePreview("buyerAccepted", "ሀበሻ");
      const analysis = calculateSmsSegments(longUcs2);

      expect(analysis.encoding).toBe("UCS-2");
      expect(analysis.characterCount).toBeGreaterThan(70);
      expect(analysis.segments).toBe(2);
      expect(analysis.exceedsSingleSegment).toBe(true);
    });

    it("switches across all supported template options", () => {
      expect(TEMPLATE_OPTIONS).toHaveLength(5);

      const accepted = renderTemplatePreview("buyerAccepted", "Habesha");
      const ready = renderTemplatePreview("buyerReady", "Habesha");
      const rejected = renderTemplatePreview("buyerRejected", "Habesha");
      const code = renderTemplatePreview("buyerNewPickupCode", "Habesha");
      const alert = renderTemplatePreview("sellerNewOrder", "Habesha");

      expect(accepted).toContain("accepted");
      expect(ready).toContain("ready. Pickup code: 4821");
      expect(rejected).toContain("sorry, your order #1043 was not accepted");
      expect(code).toContain("new pickup code for order #1043 is 7305");
      expect(alert).toContain("New order #1043: 3 items, 850 birr");
    });
  });

  describe("Storefront Link Copy & API Persistence (Acceptance Criterion 3)", () => {
    it("submits compliant PATCH payload to /api/auth/settings", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          seller: {
            id: "seller-101",
            business_name: "Habesha Modern Cafe",
            sms_name: "Habesha",
          },
        }),
      });

      const response = await saveSettingsApi(
        { business_name: "Habesha Modern Cafe", sms_name: "Habesha" },
        mockFetch as any
      );

      expect(mockFetch).toHaveBeenCalledWith("/api/auth/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: "Habesha Modern Cafe",
          sms_name: "Habesha",
        }),
      });

      expect(response.seller.business_name).toBe("Habesha Modern Cafe");
      expect(response.seller.sms_name).toBe("Habesha");
    });

    it("throws user-friendly error on failed settings update", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "SMS name cannot exceed 20 characters" },
        }),
      });

      await expect(
        saveSettingsApi(
          { business_name: "Habesha", sms_name: "WayTooLongForAnSMSName" },
          mockFetch as any
        )
      ).rejects.toThrow("SMS name cannot exceed 20 characters");
    });
  });

  describe("Component Definition", () => {
    it("is defined as a functional React component", () => {
      expect(typeof SettingsClient).toBe("function");
      const element = React.createElement(SettingsClient, { initialSeller: mockSeller });
      expect(element).toBeDefined();
      expect(element.type).toBe(SettingsClient);
      expect(element.props.initialSeller).toEqual(mockSeller);
    });

    it("accepts and passes baseUrl prop", () => {
      const element = React.createElement(SettingsClient, {
        initialSeller: mockSeller,
        baseUrl: "https://custom-shop.et",
      });
      expect(element.props.baseUrl).toBe("https://custom-shop.et");
    });
  });

  describe("Storefront URL Generation from Environment", () => {
    const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.NEXT_PUBLIC_APP_URL = originalEnv;
      } else {
        delete process.env.NEXT_PUBLIC_APP_URL;
      }
    });

    it("generates storefront URL from NEXT_PUBLIC_APP_URL environment variable", () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      expect(getStorefrontUrl("habesha-cafe")).toBe("http://localhost:3000/s/habesha-cafe");

      process.env.NEXT_PUBLIC_APP_URL = "https://ord.et";
      expect(getStorefrontUrl("habesha-cafe")).toBe("https://ord.et/s/habesha-cafe");
    });

    it("strips trailing slash from base URL", () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000/";
      expect(getStorefrontUrl("habesha-cafe")).toBe("http://localhost:3000/s/habesha-cafe");

      expect(getStorefrontUrl("habesha-cafe", "https://ord.et/")).toBe("https://ord.et/s/habesha-cafe");
    });

    it("prioritizes explicit baseUrl parameter over environment variable", () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      expect(getStorefrontUrl("habesha-cafe", "https://staging.ord.et")).toBe("https://staging.ord.et/s/habesha-cafe");
    });

    it("falls back to http://localhost:3000 when env variable is not set", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getStorefrontUrl("habesha-cafe")).toBe("http://localhost:3000/s/habesha-cafe");
    });

    it("renders SMS template preview with dynamic environment base URL in action and opt-out links", () => {
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      const buyerPreview = renderTemplatePreview("buyerAccepted", "Habesha Cafe");
      expect(buyerPreview).toContain("Stop texts: http://localhost:3000/x/Z7y1");

      const sellerPreview = renderTemplatePreview("sellerNewOrder", "Habesha Cafe");
      expect(sellerPreview).toContain("Open: http://localhost:3000/a/K9x2");

      const customPreview = renderTemplatePreview(
        "buyerAccepted",
        "Habesha Cafe",
        "https://order-by-sms-six.vercel.app"
      );
      expect(customPreview).toContain("Stop texts: https://order-by-sms-six.vercel.app/x/Z7y1");
    });

    it("renders with a centered max-width container (mx-auto)", () => {
      const { renderToString } = require("react-dom/server");
      const html = renderToString(<SettingsClient initialSeller={mockSeller} />);
      expect(html).toContain("max-w-4xl mx-auto");
    });

    it("renders profile picture placeholder when logoUrl is not provided", () => {
      const { renderToString } = require("react-dom/server");
      const html = renderToString(<SettingsClient initialSeller={mockSeller} />);
      expect(html).toContain("id=\"upload-profile-picture-btn\"");
      expect(html).toContain("id=\"profile-picture-placeholder\"");
      expect(html).not.toContain("Cloudflare R2");
      expect(html).toContain("Stored securely.");
    });

    it("renders profile picture image preview and remove button when logoUrl is provided", () => {
      const { renderToString } = require("react-dom/server");
      const html = renderToString(
        <SettingsClient
          initialSeller={{
            ...mockSeller,
            logoUrl: "https://r2.orderbysms.et/profiles/seller-101/avatar.png",
          }}
        />
      );
      expect(html).toContain("id=\"profile-picture-preview\"");
      expect(html).toContain("https://r2.orderbysms.et/profiles/seller-101/avatar.png");
      expect(html).toContain("id=\"remove-profile-picture-btn\"");
    });

    it("renders password change section and does not render GSM metrics or Snapcart Engine label", () => {
      const { renderToString } = require("react-dom/server");
      const html = renderToString(<SettingsClient initialSeller={mockSeller} />);

      // Password change form
      expect(html).toContain("id=\"current-password\"");
      expect(html).toContain("id=\"new-password\"");
      expect(html).toContain("id=\"confirm-password\"");
      expect(html).toContain("id=\"change-password-btn\"");

      // Removed unwanted text/metrics
      expect(html).not.toContain("Snapcart Engine");
      expect(html).not.toContain("id=\"sms-metrics-card\"");
      expect(html).not.toContain("Estimated Segments");
    });
  });
});
