import React from "react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

import SignupPage from "../page";

describe("SignupPage Server Component (FE-007, #30)", () => {
  it("renders SignupForm component inside layout", () => {
    const element = SignupPage();
    expect(element).toBeDefined();
    expect(element.type).toBe("div");
  });
});
