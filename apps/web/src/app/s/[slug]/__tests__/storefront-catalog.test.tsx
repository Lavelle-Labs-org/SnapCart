import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { StorefrontCatalog } from "../storefront-catalog";
import { LanguageProvider } from "../../../../lib/i18n";

describe("StorefrontCatalog Component (Landing / Seller links)", () => {
  const mockSeller = {
    id: "seller-1",
    businessName: "Habesha Spices",
    smsName: "Habesha Spices",
    slug: "habesha-spices",
    logoUrl: null,
  };

  const mockProducts = [
    {
      id: "prod-1",
      name: "Berbere Blend 500g",
      priceSantim: 25000,
      available: true,
      imageUrl: null,
    },
  ];

  it("renders top seller links and footer brand link in English", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="en">
        <StorefrontCatalog seller={mockSeller} products={mockProducts} />
      </LanguageProvider>
    );

    // Verify top utility banner links to landing / seller page
    expect(html).toContain('href="/"');
    expect(html).toContain('data-testid="storefront-top-landing-link"');
    expect(html).toContain('data-testid="storefront-top-seller-link"');
    expect(html).toContain("Create your store");
    // Verify footer brand link
    expect(html).toContain('data-testid="storefront-footer-brand-link"');
    expect(html).toContain("Powered by");
    expect(html).toContain("Snapcart");
  });

  it("reactively renders top seller links and footer brand link in Amharic", () => {
    const html = renderToString(
      <LanguageProvider initialLocale="am">
        <StorefrontCatalog seller={mockSeller} products={mockProducts} />
      </LanguageProvider>
    );

    expect(html).toContain('href="/"');
    expect(html).toContain("የራስዎን መደብር ይክፈቱ");
    expect(html).toContain("በቅጽበት ይዘዙ");
  });
});

