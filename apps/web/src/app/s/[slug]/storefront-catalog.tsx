"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight, PackageX, Plus, Minus, CheckCircle2 } from "lucide-react";
import { toBirr } from "@order-by-sms/contracts";
import { useTranslation } from "../../../lib/i18n";
import { LanguageToggle } from "../../../components/language-toggle";

export interface StorefrontSellerProp {
  id: string;
  businessName: string;
  smsName: string;
  slug: string;
}

export interface StorefrontProductProp {
  id: string;
  name: string;
  priceSantim: number;
  available: boolean;
  imageUrl?: string | null;
  image_url?: string | null;
}

interface StorefrontCatalogProps {
  seller: StorefrontSellerProp;
  products: StorefrontProductProp[];
}

export function StorefrontCatalog({ seller, products }: StorefrontCatalogProps) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isMounted, setIsMounted] = useState(false);
  const { t, isAmharic } = useTranslation();

  const storageKey = `order_by_sms_cart_${seller.slug}`;

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "object" && parsed !== null) {
          setCart(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey]);

  // Persist cart updates to localStorage
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      const updated = { ...prev };
      if (next === 0) {
        delete updated[productId];
      } else {
        updated[productId] = next;
      }

      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Ignore localStorage write errors
      }

      return updated;
    });
  };

  // Calculate totals
  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const totalSantim = Object.entries(cart).reduce((sum, [pId, qty]) => {
    const prod = products.find((p) => p.id === pId);
    return sum + (prod ? prod.priceSantim * qty : 0);
  }, 0);
  const totalBirr = toBirr(totalSantim);

  const shopDisplayName = seller.smsName || seller.businessName;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3.5 sticky top-0 z-10 flex items-center justify-between shadow-xs gap-2">
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-extrabold flex items-center justify-center text-base shadow-xs select-none flex-shrink-0">
            {shopDisplayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{shopDisplayName}</h1>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {isAmharic ? "የተረጋገጠ" : "Verified"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {isAmharic ? "በቀጥታ ይዘዙ • በጥሬ ገንዘብ ይክፈሉ" : "Order online • Cash on pickup or delivery"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <LanguageToggle />
          <div className="relative bg-emerald-50 text-emerald-700 p-2 rounded-xl border border-emerald-200 flex items-center justify-center min-h-[44px] min-w-[44px]">
            <ShoppingBag className="w-4 h-4" />
            {isMounted && totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {totalItems}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 space-y-4 flex-1">
        {products.length === 0 ? (
          // Friendly Empty State
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 mt-6">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <PackageX className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">{t.storefront.noProductsFound}</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              {isAmharic
                ? "ይህ መደብር በአሁኑ ጊዜ ለትዕዛዝ የሚሆኑ እቃዎች የሉትም። እባክዎ ቆይተው እንደገና ይመልከቱ!"
                : "This shop doesn't have any items available for ordering at the moment. Please check back later!"}
            </p>
          </div>
        ) : (
          // Product List
          <div className="space-y-3">
            {products.map((product) => {
              const qty = isMounted ? cart[product.id] || 0 : 0;
              const priceBirr = toBirr(product.priceSantim);

              return (
                <div
                  key={product.id}
                  className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between transition hover:border-slate-300 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 flex-shrink-0 overflow-hidden relative flex items-center justify-center">
                      {product.imageUrl || product.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={product.imageUrl || product.image_url || ""}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 pr-2">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">{product.name}</h3>
                      <p className="text-sm font-bold text-emerald-700 tabular-nums mt-1">
                        {priceBirr} {t.common.currency}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Controls with >=44px touch targets */}
                  <div>
                    {qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, 1)}
                        className="min-h-[44px] min-w-[72px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-1"
                        aria-label={`Add ${product.name} to cart`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t.storefront.addToCart}</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1.5 bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-11 h-11 min-h-[44px] min-w-[44px] bg-white text-slate-700 hover:bg-slate-200 rounded-lg flex items-center justify-center transition shadow-xs active:scale-95"
                          aria-label={`Decrease quantity of ${product.name}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-7 text-center font-bold text-slate-900 text-sm">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(product.id, 1)}
                          className="w-11 h-11 min-h-[44px] min-w-[44px] bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center justify-center transition shadow-xs active:scale-95"
                          aria-label={`Increase quantity of ${product.name}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Sticky Bottom Checkout Footer */}
      {products.length > 0 && (
        <footer className="bg-white border-t border-slate-200 p-4 sticky bottom-0 z-20 shadow-xs">
          {isMounted && totalItems > 0 ? (
            <Link
              href={`/s/${seller.slug}/checkout`}
              className="w-full min-h-[48px] flex items-center justify-between bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold px-5 py-3.5 rounded-xl transition shadow-md"
            >
              <span className="text-sm">
                {t.storefront.viewCart} ({t.storefront.itemsCount(totalItems)})
              </span>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base">
                  {totalBirr} {t.common.currency}
                </span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ) : (
            <div className="w-full min-h-[48px] flex items-center justify-between bg-slate-100 text-slate-400 font-medium px-5 py-3.5 rounded-xl cursor-not-allowed text-sm">
              <span>{isAmharic ? "እቃዎችን በመምረጥ ማዘዝ ይጀምሩ" : "Select items to start order"}</span>
              <span>0 {t.common.currency}</span>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
