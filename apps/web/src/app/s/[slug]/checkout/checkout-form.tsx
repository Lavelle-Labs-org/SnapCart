"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Loader2, AlertCircle, ShoppingBag, CheckCircle2, Zap } from "lucide-react";
import { normalizeEthiopianPhone, toBirr } from "@order-by-sms/contracts";
import { useTranslation } from "../../../../lib/i18n";
import { LanguageToggle } from "../../../../components/language-toggle";

export interface CheckoutSellerProp {
  id: string;
  businessName: string;
  smsName: string;
  slug: string;
}

export interface CheckoutProductProp {
  id: string;
  name: string;
  priceSantim: number;
  available: boolean;
}

interface CheckoutFormProps {
  seller: CheckoutSellerProp;
  products: CheckoutProductProp[];
}

export function CheckoutForm({ seller, products }: CheckoutFormProps) {
  const router = useRouter();
  const { t, isAmharic } = useTranslation();
  const storageKey = `order_by_sms_cart_${seller.slug}`;

  const [cart, setCart] = useState<Record<string, number>>({});
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false); // FR-9: unticked by default
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [isRecognizedBuyer, setIsRecognizedBuyer] = useState(false);

  // Check if returning verified buyer (Instant Checkout prefill)
  useEffect(() => {
    async function loadBuyerProfile() {
      try {
        const res = await fetch("/api/checkout/buyer/me", {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const profile = await res.json();
          if (profile.authenticated && profile.customer) {
            setName((prev) => prev || profile.customer.name || "");
            setPhone((prev) => prev || profile.customer.phone || "");
            setIsRecognizedBuyer(true);
          }
        }
      } catch {
        // Ignore network errors for optional prefill
      }
    }
    loadBuyerProfile();
  }, []);

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

  // Derive cart items
  const activeCartEntries = Object.entries(cart).filter(([_, qty]) => qty > 0);
  const cartItems = activeCartEntries.map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId);
    return {
      productId,
      quantity,
      name: product ? product.name : "Product",
      unitPriceSantim: product ? product.priceSantim : 0,
      totalSantim: product ? product.priceSantim * quantity : 0,
    };
  });

  const totalSantim = cartItems.reduce((sum, item) => sum + item.totalSantim, 0);
  const totalBirr = toBirr(totalSantim);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const errors: { name?: string; phone?: string } = {};

    // Validate name
    if (!name.trim()) {
      errors.name = "Your full name is required.";
    }

    // Validate Ethiopian phone
    const phoneValidation = normalizeEthiopianPhone(phone);
    if (!phoneValidation.isValid) {
      errors.phone =
        "Invalid Ethiopian mobile number. Must start with 09 (Ethio Telecom) or 07 (Safaricom) with 10 digits.";
    }

    // Validate cart has items
    if (cartItems.length === 0) {
      setErrorMessage("Your cart is empty. Please add products before checking out.");
      return;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        slug: seller.slug,
        buyerName: name.trim(),
        buyerPhone: phone.trim(),
        smsConsent,
        consentWording:
          "Send me SMS updates about this order (Accepted, Ready, and Handover code).",
        items: cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      };

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        const message =
          data?.error?.message ||
          data?.message ||
          "Failed to initiate order verification. Please check your details.";
        setErrorMessage(message);
        setIsSubmitting(false);
        return;
      }

      // Successful response: either instant order or OTP verification draft
      const responseData = data.data || data;

      // Instant checkout for recognized verified customer (BE-008, FR-7)
      if (responseData.verified === true) {
        try {
          if (typeof window !== "undefined") {
            localStorage.removeItem(storageKey);
          }
        } catch (storageErr) {
          console.warn("Could not clear localStorage cart:", storageErr);
        }

        const orderId = responseData.orderId || responseData.order?.id || "";
        const orderNumber = responseData.orderNumber || responseData.order?.number || "";
        const consentParam = smsConsent ? "&consent=true" : "&consent=false";

        router.push(
          `/s/${seller.slug}/done?orderId=${encodeURIComponent(
            String(orderId)
          )}&orderNumber=${encodeURIComponent(String(orderNumber))}${consentParam}`
        );
        return;
      }

      // First time or unrecognized device: extract draftId and navigate to verify
      const draftId = responseData.draftId;
      if (!draftId) {
        throw new Error("Missing draft ID from checkout response");
      }

      router.push(`/s/${seller.slug}/verify/${draftId}`);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "A network or server error occurred. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <Link
            href={`/s/${seller.slug}`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg transition"
            aria-label="Back to store"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {isAmharic ? "ትዕዛዝ ማጠናቀቂያ" : "Checkout"}
            </h1>
            <p className="text-xs text-slate-500 truncate">{seller.smsName || seller.businessName}</p>
          </div>
        </div>
        <LanguageToggle />
      </header>

      <main className="p-4 space-y-6 flex-1">
        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start space-x-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">
                {isAmharic ? "ትዕዛዙን ማስገባት አልተቻለም" : "Could not submit checkout"}
              </span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Empty Cart Warning */}
        {isMounted && cartItems.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">{t.storefront.cartEmpty}</h2>
            <p className="text-xs text-slate-500">
              {t.storefront.cartEmptyDesc}
            </p>
            <div className="pt-2">
              <Link
                href={`/s/${seller.slug}`}
                className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl text-xs transition"
              >
                {t.storefront.startShopping}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Order Summary */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                {t.checkout.orderSummary}
              </h2>
              <div className="space-y-2 text-sm">
                {cartItems.map((item) => (
                  <div key={item.productId} className="flex justify-between items-center py-0.5">
                    <span className="text-slate-800">
                      <strong className="text-slate-900 font-semibold">{item.quantity}x</strong>{" "}
                      {item.name}
                    </span>
                    <span className="font-medium text-slate-700">
                      {toBirr(item.totalSantim)} {t.common.currency}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t my-3 border-slate-100"></div>
              <div className="flex justify-between items-center font-bold text-base text-slate-900">
                <span>{t.checkout.orderTotal}</span>
                <span className="text-emerald-600 text-lg">
                  {totalBirr} {t.common.currency}
                </span>
              </div>
            </div>

            {/* Customer Information Form */}
            <form id="checkout-form" onSubmit={handleSubmit} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {isAmharic ? "የደንበኛ መረጃ" : "Buyer Contact Details"}
                </h2>
                {isRecognizedBuyer && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{isAmharic ? "የተረጋገጠ ደንበኛ" : "Verified Buyer"}</span>
                  </span>
                )}
              </div>

              {isRecognizedBuyer && (
                <div className="flex items-center space-x-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {isAmharic
                      ? "እንኳን ደህና መጡ! በዚህ መሳሪያ ላይ ፈጣን ክፍያ ነቅቷል (የኤስኤምኤስ ኮድ አያስፈልግም)።"
                      : "Welcome back! Instant checkout is enabled on this device (No SMS OTP required)."}
                  </span>
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-xs font-medium text-slate-700 mb-1">
                  {t.checkout.customerNameLabel} <span className="text-rose-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder={t.checkout.customerNamePlaceholder}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                    fieldErrors.name
                      ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                      : "border-slate-300 focus:ring-emerald-500"
                  }`}
                  disabled={isSubmitting}
                />
                {fieldErrors.name && (
                  <p className="text-rose-600 text-xs mt-1">{fieldErrors.name}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="phone" className="block text-xs font-medium text-slate-700">
                    {t.checkout.phoneLabel} <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-medium text-slate-400">
                    Ethio Telecom (09) • Safaricom (07)
                  </span>
                </div>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (fieldErrors.phone) {
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  placeholder={t.checkout.phonePlaceholder}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                    fieldErrors.phone
                      ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                      : "border-slate-300 focus:ring-emerald-500"
                  }`}
                  disabled={isSubmitting}
                />
                {fieldErrors.phone ? (
                  <p className="text-rose-600 text-xs mt-1">{fieldErrors.phone}</p>
                ) : isRecognizedBuyer ? (
                  <p className="text-[11px] text-emerald-700 mt-1 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 inline shrink-0" />
                    <span>
                      {isAmharic
                        ? "መሳሪያዎ ታውቋል። ትዕዛዝዎ ወዲያውኑ ይረጋገጣል።"
                        : "Device recognized. Your order will be placed instantly."}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {t.checkout.phoneHelper}
                  </p>
                )}
              </div>

              {/* SMS Consent Checkbox (Unticked by default as per FR-9) */}
              <div className={`p-3 rounded-xl border transition ${smsConsent ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
                <label className="flex items-center space-x-3 text-xs text-slate-700 cursor-pointer select-none min-h-[44px]">
                  <input
                    type="checkbox"
                    id="sms_consent"
                    name="sms_consent"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-5 w-5 border-slate-300 transition"
                    disabled={isSubmitting}
                  />
                  <span className="leading-relaxed">
                    {isAmharic
                      ? "ስለዚህ ትዕዛዝ የኤስኤምኤስ ማሳወቂያዎች ይላኩልኝ (የተቀበለ፣ ዝግጁ የሆነ፣ እና የመረከቢያ ኮድ)"
                      : "Send me SMS updates about this order (Accepted, Ready, and Handover code)."}
                  </span>
                </label>
              </div>
            </form>

            <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 p-3 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {isAmharic
                  ? "መለያ መክፈት አያስፈልግም። እቃውን ሲረከቡ በጥሬ ገንዘብ ይክፈሉ።"
                  : "No account required. Payment in cash upon delivery or pickup."}
              </span>
            </div>
          </>
        )}
      </main>

      {/* Sticky Bottom Submit Button */}
      {isMounted && cartItems.length > 0 && (
        <footer className="bg-white border-t p-4 sticky bottom-0 z-20 shadow-lg">
          <button
            type="submit"
            form="checkout-form"
            disabled={isSubmitting}
            className={`w-full min-h-[48px] flex items-center justify-center font-semibold px-5 py-3.5 rounded-xl transition text-sm shadow-md ${
              isSubmitting
                ? "bg-emerald-400 text-white cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {isAmharic
                    ? "እየተላከ ነው..."
                    : isRecognizedBuyer
                    ? "Placing Order..."
                    : "Sending Verification Code..."}
                </span>
              </span>
            ) : isRecognizedBuyer ? (
              <span className="flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-emerald-200 fill-emerald-200" />
                <span>
                  {isAmharic ? "ትዕዛዝ አረጋግጥ (ፈጣን ክፍያ)" : "Place Order (Instant Checkout)"}
                </span>
              </span>
            ) : (
              <span>{isAmharic ? "የማረጋገጫ ኮድ ላክ (SMS)" : "Send Verification Code (SMS)"}</span>
            )}
          </button>
        </footer>
      )}
    </div>
  );
}
