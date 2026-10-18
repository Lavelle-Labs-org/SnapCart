import { describe, it, expect } from "vitest";
import {
  toSantim,
  toBirr,
  formatBirr,
} from "../src/money";

describe("Santim-Birr Currency Conversion Helpers (CLEANUP-002, #6)", () => {
  describe("toSantim()", () => {
    it("converts integer Birr to Santim correctly", () => {
      expect(toSantim(350)).toBe(35000);
      expect(toSantim(0)).toBe(0);
      expect(toSantim(1)).toBe(100);
      expect(toSantim(99999)).toBe(9999900);
    });

    it("converts decimal Birr avoiding JavaScript floating point issues", () => {
      expect(toSantim(19.99)).toBe(1999);
      expect(toSantim(350.50)).toBe(35050);
      expect(toSantim(0.01)).toBe(1);
      expect(toSantim(0.05)).toBe(5);
      expect(toSantim(1.005)).toBe(101); // rounds to nearest santim
    });

    it("handles negative values or edge numbers safely", () => {
      expect(toSantim(-10)).toBe(-1000);
      expect(() => toSantim(NaN)).toThrow("Invalid monetary amount: NaN");
    });
  });

  describe("toBirr()", () => {
    it("converts integer Santim to Birr correctly", () => {
      expect(toBirr(35000)).toBe(350);
      expect(toBirr(0)).toBe(0);
      expect(toBirr(100)).toBe(1);
      expect(toBirr(1999)).toBe(19.99);
      expect(toBirr(50)).toBe(0.5);
    });

    it("handles invalid numbers safely", () => {
      expect(() => toBirr(NaN)).toThrow("Invalid santim amount: NaN");
    });
  });

  describe("formatBirr()", () => {
    it("formats Santim to standard ETB string representation with 2 decimal places", () => {
      expect(formatBirr(35050)).toBe("350.50 ETB");
      expect(formatBirr(35000)).toBe("350.00 ETB");
      expect(formatBirr(0)).toBe("0.00 ETB");
      expect(formatBirr(1999)).toBe("19.99 ETB");
      expect(formatBirr(5)).toBe("0.05 ETB");
    });

    it("handles custom currency symbol or suffix if provided", () => {
      expect(formatBirr(35050, { suffix: "" })).toBe("350.50");
      expect(formatBirr(35050, { suffix: " Birr" })).toBe("350.50 Birr");
    });

    it("handles invalid numbers safely", () => {
      expect(() => formatBirr(NaN)).toThrow("Invalid santim amount: NaN");
    });
  });
});
