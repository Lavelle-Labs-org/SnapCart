import { describe, it, expect } from "vitest";
import { CONTRACTS_VERSION } from "@order-by-sms/contracts";

describe("Shared Contracts Package (@order-by-sms/contracts)", () => {
  it("exports contracts version identifier", () => {
    expect(CONTRACTS_VERSION).toBe("0.1.0");
  });
});
