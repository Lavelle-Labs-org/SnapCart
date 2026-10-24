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

import LoginPage from "../page";

describe("LoginPage Server Component (FE-008, #31)", () => {
  it("renders LoginPage with LoginForm component", () => {
    const element = LoginPage();
    expect(element).toBeDefined();
    expect(element.type).toBe("div");
  });

  it("renders ThemeToggle and home navigation in header", () => {
    const html = renderToString(<LoginPage />);
    expect(html).toContain('aria-label="Toggle color theme"');
    expect(html).toContain('href="/"');
  });
});
