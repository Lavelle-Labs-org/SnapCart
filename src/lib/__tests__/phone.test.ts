import { describe, it, expect } from "vitest";
import { normalizeEthiopianPhone, maskPhoneNumber } from "../phone";

describe("Ethiopian Phone Normalization", () => {
  it("normalizes Ethio Telecom local format 09...", () => {
    const res = normalizeEthiopianPhone("0912345678");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("0912345678");
    expect(res.network).toBe("ethio_telecom");
  });

  it("normalizes Safaricom local format 07...", () => {
    const res = normalizeEthiopianPhone("0712345678");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("0712345678");
    expect(res.network).toBe("safaricom");
  });

  it("normalizes international format with +251", () => {
    const res = normalizeEthiopianPhone("+251912345678");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("0912345678");
    expect(res.network).toBe("ethio_telecom");
  });

  it("normalizes format with dashes and spaces", () => {
    const res = normalizeEthiopianPhone("09-12 34 56 78");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("0912345678");
  });

  it("rejects invalid or international numbers", () => {
    const res = normalizeEthiopianPhone("+14155552671");
    expect(res.isValid).toBe(false);
  });

  it("masks phone numbers correctly", () => {
    expect(maskPhoneNumber("0912345678")).toBe("09•• ••• 678");
  });
});
