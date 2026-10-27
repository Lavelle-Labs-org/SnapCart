/**
 * Pure Demo Store Configuration (Offline & DB-Independent)
 *
 * Provides a self-contained mock seller and catalog for the demo storefront
 * (/s/habesha-cafe and /demo), guaranteeing zero database calls, zero external
 * network latency, and zero dependency on postgres seeding.
 */

export const DEMO_STORE_SLUG = "habesha-cafe";

export function isDemoStore(slug?: string | null): boolean {
  if (!slug) return false;
  const normalized = slug.trim().toLowerCase();
  return normalized === "habesha-cafe" || normalized === "demo";
}

export const DEMO_SELLER = {
  id: "demo-seller-habesha",
  businessName: "Habesha Cafe & Bakery",
  smsName: "Habesha Cafe",
  slug: "habesha-cafe",
  logoUrl: null,
};

export const DEMO_PRODUCTS = [
  {
    id: "demo-prod-combo",
    name: "Special Combo Platter",
    priceSantim: 35000, // 350.00 ETB
    available: true,
    imageUrl: null,
  },
  {
    id: "demo-prod-doro",
    name: "Single Doro Wat",
    priceSantim: 22000, // 220.00 ETB
    available: true,
    imageUrl: null,
  },
  {
    id: "demo-prod-shiro",
    name: "Shiro Tegamino",
    priceSantim: 18000, // 180.00 ETB
    available: true,
    imageUrl: null,
  },
  {
    id: "demo-prod-coffee",
    name: "Fresh Roasted Coffee (1kg)",
    priceSantim: 60000, // 600.00 ETB
    available: true,
    imageUrl: null,
  },
];
