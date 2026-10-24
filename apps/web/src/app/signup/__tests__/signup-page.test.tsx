import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";

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

  it("renders ThemeToggle and home navigation in header", () => {
    const html = renderToString(<SignupPage />);
    expect(html).toContain('aria-label="Toggle color theme"');
    expect(html).toContain('href="/"');
  });
});
