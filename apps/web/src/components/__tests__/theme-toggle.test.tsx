import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ThemeToggle } from "../theme-toggle";

describe("ThemeToggle Component", () => {
  it("renders a toggle button with accessible aria-label", () => {
    const html = renderToString(<ThemeToggle />);
    expect(html).toContain('aria-label="Toggle color theme"');
    expect(html).toContain("button");
    // Ensure 44px touch target compliance
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("min-w-[44px]");
  });

  it("renders label when showLabel is true", () => {
    const html = renderToString(<ThemeToggle showLabel={true} />);
    expect(html).toContain("Theme");
  });

  it("applies custom className", () => {
    const html = renderToString(<ThemeToggle className="custom-test-class" />);
    expect(html).toContain("custom-test-class");
  });
});
