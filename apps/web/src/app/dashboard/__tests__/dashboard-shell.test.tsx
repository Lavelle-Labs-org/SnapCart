import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";
import { DashboardShell } from "../dashboard-shell";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("DashboardShell Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders navigation items, seller info, and children", () => {
    const html = renderToString(
      <DashboardShell
        seller={{ business_name: "Habesha Coffee", slug: "habesha-coffee" }}
        displayName="Habesha Coffee"
        displaySubtitle="@habesha-coffee"
      >
        <div id="dashboard-child">Welcome Content</div>
      </DashboardShell>
    );

    expect(html).toContain("Welcome Content");
    expect(html).toContain("Habesha Coffee");
    expect(html).toContain("@habesha-coffee");

    // All primary navigation routes are present in links
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('href="/dashboard/messages"');
    expect(html).toContain('href="/dashboard/products"');
    expect(html).toContain('href="/dashboard/settings"');
    expect(html).toContain('href="/login"');
  });

  it("renders storefront quick link in mobile header when slug is present", () => {
    const html = renderToString(
      <DashboardShell
        seller={{ business_name: "Habesha Coffee", slug: "habesha-coffee" }}
        displayName="Habesha Coffee"
        displaySubtitle="@habesha-coffee"
      >
        <div>Content</div>
      </DashboardShell>
    );

    expect(html).toContain('href="/s/habesha-coffee"');
  });

  it("renders collapse/expand controls and responsive sidebars", () => {
    const html = renderToString(
      <DashboardShell
        seller={{ business_name: "Habesha Coffee", slug: "habesha-coffee" }}
        displayName="Habesha Coffee"
        displaySubtitle="@habesha-coffee"
      >
        <div>Content</div>
      </DashboardShell>
    );

    // Desktop sidebar has w-64 by default and transition classes
    expect(html).toContain("w-64");
    expect(html).toContain("transition-all");
    expect(html).toContain("aria-label=\"Collapse sidebar\"");

    // Mobile app bar has hamburger button
    expect(html).toContain("aria-label=\"Open navigation menu\"");
  });
});
