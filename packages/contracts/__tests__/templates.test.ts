import { describe, it, expect } from "vitest";
import {
  detectEncoding,
  getMaxCharacters,
  truncateShopName,
  calculateSmsSegments,
  SMS_TEMPLATES,
} from "../src/templates";

describe("Contracts SMS Templates & Segment Analysis", () => {
  describe("detectEncoding", () => {
    it("identifies pure GSM-7 text correctly", () => {
      expect(detectEncoding("Habesha Cafe: order #1001 accepted.")).toBe("GSM-7");
    });

    it("identifies non-GSM characters like Amharic as UCS-2", () => {
      expect(detectEncoding("ሀበሻ ካፌ")).toBe("UCS-2");
    });

    it("identifies emojis as UCS-2", () => {
      expect(detectEncoding("Order #1001 ☕")).toBe("UCS-2");
    });

    it("identifies curly quotes as UCS-2", () => {
      expect(detectEncoding("Don’t miss out")).toBe("UCS-2");
    });
  });

  describe("calculateSmsSegments", () => {
    it("calculates 1 segment for GSM-7 text under 160 characters", () => {
      const text = "Habesha Cafe: order #1043 accepted. We will text when ready. Stop texts: https://ord.et/x/Z7y1";
      const analysis = calculateSmsSegments(text);
      expect(analysis.encoding).toBe("GSM-7");
      expect(analysis.hasNonGsm).toBe(false);
      expect(analysis.segments).toBe(1);
      expect(analysis.singleSegmentLimit).toBe(160);
      expect(analysis.exceedsSingleSegment).toBe(false);
      expect(analysis.remainingInSingleSegment).toBe(160 - text.length);
    });

    it("calculates multiple segments for GSM-7 text exceeding 160 characters", () => {
      const longText = "A".repeat(161);
      const analysis = calculateSmsSegments(longText);
      expect(analysis.encoding).toBe("GSM-7");
      expect(analysis.segments).toBe(2);
      expect(analysis.exceedsSingleSegment).toBe(true);
      expect(analysis.remainingInSingleSegment).toBe(0);
    });

    it("calculates 1 segment for UCS-2 text under 70 characters", () => {
      const amharicText = "ትዕዛዝዎ #1043 ተቀብሏል። ዝግጁ ሲሆን እናሳውቅዎታለን።";
      const analysis = calculateSmsSegments(amharicText);
      expect(analysis.encoding).toBe("UCS-2");
      expect(analysis.hasNonGsm).toBe(true);
      expect(analysis.singleSegmentLimit).toBe(70);
      expect(analysis.segments).toBe(1);
      expect(analysis.exceedsSingleSegment).toBe(false);
    });

    it("calculates multiple segments for UCS-2 text exceeding 70 characters", () => {
      const longAmharic = "ት".repeat(71);
      const analysis = calculateSmsSegments(longAmharic);
      expect(analysis.encoding).toBe("UCS-2");
      expect(analysis.hasNonGsm).toBe(true);
      expect(analysis.singleSegmentLimit).toBe(70);
      expect(analysis.segments).toBe(2);
      expect(analysis.exceedsSingleSegment).toBe(true);
    });

    it("handles empty string gracefully", () => {
      const analysis = calculateSmsSegments("");
      expect(analysis.characterCount).toBe(0);
      expect(analysis.segments).toBe(0);
      expect(analysis.exceedsSingleSegment).toBe(false);
    });
  });

  describe("truncateShopName", () => {
    it("truncates names longer than 20 chars", () => {
      expect(truncateShopName("12345678901234567890EXTRA")).toBe("12345678901234567890");
    });

    it("returns 'Shop' if empty", () => {
      expect(truncateShopName("")).toBe("Shop");
    });
  });
});
