"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Store,
  Send,
} from "lucide-react";
import {
  calculateSmsSegments,
  detectEncoding,
  SMS_TEMPLATES,
} from "@order-by-sms/contracts";

export interface SellerSettingsData {
  id: string;
  businessName: string;
  smsName: string;
  slug: string;
  phone: string;
}

export interface SettingsClientProps {
  initialSeller: SellerSettingsData;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

/**
 * Returns the fully-qualified storefront URL using configured environment base URL
 * (fallback to NEXT_PUBLIC_APP_URL or http://localhost:3000).
 */
export function getStorefrontUrl(slug: string, baseUrl?: string): string {
  let appBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL;
  if (!appBaseUrl && typeof window !== "undefined" && window.location?.origin) {
    appBaseUrl = window.location.origin;
  }
  appBaseUrl = (appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
  return `${appBaseUrl}/s/${slug}`;
}

export type TemplateKey =
  | "buyerAccepted"
  | "buyerReady"
  | "buyerRejected"
  | "buyerNewPickupCode"
  | "sellerNewOrder";

export const TEMPLATE_OPTIONS: { key: TemplateKey; label: string; recipient: string }[] = [
  { key: "buyerAccepted", label: "Order Accepted", recipient: "Buyer" },
  { key: "buyerReady", label: "Order Ready", recipient: "Buyer" },
  { key: "buyerRejected", label: "Order Rejected", recipient: "Buyer" },
  { key: "buyerNewPickupCode", label: "New Pickup Code", recipient: "Buyer" },
  { key: "sellerNewOrder", label: "New Order Alert", recipient: "Seller" },
];

/**
 * Validates business name and SMS name input fields.
 */
export function validateShopSettings(businessName: string, smsName: string): {
  isValid: boolean;
  isBusinessNameValid: boolean;
  isSmsNameValid: boolean;
  hasNonGsm: boolean;
  error?: string;
} {
  const trimmedBusiness = businessName.trim();
  const trimmedSms = smsName.trim();

  const isBusinessNameValid = trimmedBusiness.length >= 2 && trimmedBusiness.length <= 100;
  const isSmsNameValid = trimmedSms.length >= 2 && trimmedSms.length <= 20;
  const hasNonGsm = trimmedSms.length > 0 && detectEncoding(trimmedSms) === "UCS-2";

  let error: string | undefined;
  if (!isBusinessNameValid) {
    error = "Business name must be between 2 and 100 characters";
  } else if (!isSmsNameValid) {
    error = "SMS name must be between 2 and 20 characters";
  }

  return {
    isValid: isBusinessNameValid && isSmsNameValid,
    isBusinessNameValid,
    isSmsNameValid,
    hasNonGsm,
    error,
  };
}

/**
 * Renders a sample SMS message for live preview using active SMS name.
 */
export function renderTemplatePreview(
  templateKey: TemplateKey,
  smsName: string,
  baseUrl?: string
): string {
  let appBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL;
  if (!appBaseUrl && typeof window !== "undefined" && window.location?.origin) {
    appBaseUrl = window.location.origin;
  }
  appBaseUrl = (appBaseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const activeShopName = smsName.trim() || "Shop";
  switch (templateKey) {
    case "buyerAccepted":
      return SMS_TEMPLATES.buyerAccepted({
        shopName: activeShopName,
        orderNumber: 1043,
        link: `${appBaseUrl}/x/Z7y1`,
      });
    case "buyerReady":
      return SMS_TEMPLATES.buyerReady({
        shopName: activeShopName,
        orderNumber: 1043,
        code: "4821",
      });
    case "buyerRejected":
      return SMS_TEMPLATES.buyerRejected({
        shopName: activeShopName,
        orderNumber: 1043,
      });
    case "buyerNewPickupCode":
      return SMS_TEMPLATES.buyerNewPickupCode({
        shopName: activeShopName,
        orderNumber: 1043,
        code: "7305",
      });
    case "sellerNewOrder":
      return SMS_TEMPLATES.sellerNewOrder({
        shopName: activeShopName,
        orderNumber: 1043,
        itemCount: 3,
        totalBirr: 850,
        link: `${appBaseUrl}/a/K9x2`,
      });
    default:
      return "";
  }
}

/**
 * Submits updated shop settings to PATCH /api/auth/settings.
 */
export async function saveSettingsApi(
  data: { business_name: string; sms_name: string },
  fetchFn: typeof fetch = fetch
) {
  const res = await fetchFn("/api/auth/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      body?.error?.message ||
      body?.message ||
      `Failed to update settings (HTTP ${res.status})`;
    throw new Error(message);
  }

  return body;
}

export default function SettingsClient({
  initialSeller,
  fetchFn = typeof fetch !== "undefined" ? fetch : (async () => ({} as any)),
  baseUrl,
}: SettingsClientProps) {
  const [businessName, setBusinessName] = useState(initialSeller.businessName || "");
  const [smsName, setSmsName] = useState(initialSeller.smsName || "");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("buyerAccepted");
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  const slug = initialSeller.slug || "shop";
  const [storefrontUrl, setStorefrontUrl] = useState(() => getStorefrontUrl(slug, baseUrl));

  // Sync with browser origin if available on client mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.location?.origin) {
      const origin = window.location.origin.replace(/\/+$/, "");
      if (!baseUrl || baseUrl === "http://localhost:3000" || window.location.hostname !== "localhost") {
        setStorefrontUrl(`${origin}/s/${slug}`);
      }
    }
  }, [baseUrl, slug]);

  const currentBaseUrl = storefrontUrl
    ? storefrontUrl.replace(/\/s\/[^/]+$/, "")
    : (baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");

  // Real-time validations
  const isBusinessNameValid =
    businessName.trim().length >= 2 && businessName.trim().length <= 100;
  const isSmsNameValid =
    smsName.trim().length >= 2 && smsName.trim().length <= 20;
  const isFormValid = isBusinessNameValid && isSmsNameValid;

  // SMS Name specific warnings
  const smsNameEncoding = detectEncoding(smsName);
  const smsNameHasNonGsm = smsName.length > 0 && smsNameEncoding === "UCS-2";

  // Compute live rendered template text using dynamic environment / current URL
  const renderedMessage = React.useMemo(() => {
    return renderTemplatePreview(selectedTemplate, smsName, currentBaseUrl);
  }, [selectedTemplate, smsName, currentBaseUrl]);

  const smsAnalysis = React.useMemo(() => {
    return calculateSmsSegments(renderedMessage);
  }, [renderedMessage]);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(storefrontUrl);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard fallback
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSaving) return;

    setIsSaving(true);
    setSaveStatus("idle");
    setSaveMessage("");

    try {
      const res = await fetchFn("/api/auth/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          sms_name: smsName.trim(),
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const errorText =
          data?.error?.message ||
          data?.message ||
          "Failed to save shop settings. Please try again.";
        setSaveStatus("error");
        setSaveMessage(errorText);
        return;
      }

      setSaveStatus("success");
      setSaveMessage("Shop settings saved successfully!");
      if (data?.seller) {
        if (data.seller.businessName) setBusinessName(data.seller.businessName);
        if (data.seller.smsName) setSmsName(data.seller.smsName);
      }
    } catch (err: any) {
      setSaveStatus("error");
      setSaveMessage(err?.message || "Network error while saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 mb-1">
          <Store className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Storefront & SMS Configuration
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Shop Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your customer-facing shop identity, storefront shareable link, and SMS notification branding.
        </p>
      </div>

      {/* Storefront Link Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>Storefront Link</span>
          </h2>
          <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2.5 py-1 rounded-full border border-emerald-200">
            Active Catalog
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Share this direct link in your Telegram channel, Instagram bio, or TikTok profile for customers to browse and order without an app download.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            id="storefront-link-input"
            type="text"
            readOnly
            value={storefrontUrl}
            className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-slate-100 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <div className="flex items-center gap-2">
            <button
              id="copy-storefront-btn"
              type="button"
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition min-h-[44px] shadow-sm ${
                isCopied
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <a
              id="open-storefront-link"
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open storefront in new tab"
              className="flex items-center justify-center p-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition min-h-[44px] min-w-[44px]"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-6 space-y-6">
          <form
            id="shop-settings-form"
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5"
          >
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Shop & SMS Branding
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Saved values appear at the beginning of all outgoing SMS alerts.
              </p>
            </div>

            {/* Business Name Field */}
            <div>
              <label
                htmlFor="business-name-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Business Name
              </label>
              <input
                id="business-name-input"
                type="text"
                value={businessName}
                maxLength={100}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  setSaveStatus("idle");
                }}
                placeholder="e.g. Habesha Cafe & Bakery"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                  !isBusinessNameValid && businessName.length > 0
                    ? "border-rose-300 focus:ring-rose-400 bg-rose-50/20 text-rose-900 dark:text-rose-200"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 px-1">
                <span>Full name shown on web storefront</span>
                <span>{businessName.length} / 100</span>
              </div>
            </div>

            {/* SMS Sender Name Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label
                  htmlFor="sms-name-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                >
                  SMS Sender Name
                </label>
                <span
                  id="sms-name-char-count"
                  className={`text-xs font-mono font-medium ${
                    smsName.length > 20
                      ? "text-rose-600 font-bold"
                      : smsName.length >= 18
                      ? "text-amber-600"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {smsName.length} / 20 chars
                </span>
              </div>

              <input
                id="sms-name-input"
                type="text"
                value={smsName}
                maxLength={20}
                onChange={(e) => {
                  setSmsName(e.target.value);
                  setSaveStatus("idle");
                }}
                placeholder="e.g. Habesha Cafe"
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                  smsName.length > 20
                    ? "border-rose-400 focus:ring-rose-400 bg-rose-50/30 text-rose-900 dark:text-rose-200"
                    : smsNameHasNonGsm
                    ? "border-amber-400 focus:ring-amber-500 bg-amber-50/20 text-slate-900 dark:text-slate-100"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              />

              <div className="text-[11px] text-slate-500 mt-1 px-1">
                Max 20 characters. Precedes every SMS message (e.g. &quot;Habesha Cafe: ...&quot;).
              </div>

              {/* Non-GSM Warning Banner */}
              {smsNameHasNonGsm && (
                <div
                  id="non-gsm-warning"
                  className="mt-3 p-3 bg-amber-50 border border-amber-200/90 rounded-xl flex items-start space-x-2 text-xs text-amber-900 animate-fadeIn"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold block text-amber-800">
                      Non-GSM Characters Detected (UCS-2 Encoding)
                    </span>
                    <p className="text-[11px] text-amber-700 leading-normal">
                      Your SMS name contains non-standard characters (e.g. Amharic Ge&apos;ez script, emoji, or curly punctuation). This reduces the single-SMS segment limit from <strong>160 to 70 characters</strong> and may consume additional SMS credits.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback Notifications */}
            {saveStatus === "success" && (
              <div
                id="save-success-banner"
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-800"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}

            {saveStatus === "error" && (
              <div
                id="save-error-banner"
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-800"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{saveMessage}</span>
              </div>
            )}

            {/* Save Button */}
            <button
              id="save-settings-btn"
              type="submit"
              disabled={!isFormValid || isSaving}
              className={`w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-medium text-sm transition min-h-[44px] shadow-sm ${
                !isFormValid || isSaving
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.99]"
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Live SMS Template Previewer</span>
              </h2>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                Section 3 Spec
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a message event to preview how your shop name looks and verify character limits before customers receive it:
            </p>

            {/* Template Selector Tabs */}
            <div
              id="template-picker-tabs"
              className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              {TEMPLATE_OPTIONS.map((tmpl) => {
                const isActive = selectedTemplate === tmpl.key;
                return (
                  <button
                    key={tmpl.key}
                    id={`template-tab-${tmpl.key}`}
                    type="button"
                    onClick={() => setSelectedTemplate(tmpl.key)}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium transition text-left min-h-[44px] flex flex-col justify-center ${
                      isActive
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-750"
                    }`}
                  >
                    <span className="truncate">{tmpl.label}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-normal">
                      To: {tmpl.recipient}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Phone Message Bubble Mockup */}
            <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-200 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Outbound SMS Bubble</span>
                </span>
                <span>Ethio / Safaricom Gateway</span>
              </div>

              {/* Message Bubble */}
              <div className="bg-emerald-600 text-white p-3.5 rounded-xl rounded-tl-sm text-xs font-mono leading-relaxed break-words whitespace-pre-wrap select-all shadow-xs">
                <span id="rendered-sms-preview">{renderedMessage}</span>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                + Default verified legal signature (~25 chars) appended by SMSHub upon dispatch
              </div>
            </div>

            {/* Metrics Breakdown Card */}
            <div
              id="sms-metrics-card"
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
            >
              <div className="grid grid-cols-2 gap-4">
                {/* Encoding Metric */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Encoding
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span
                      id="preview-encoding-badge"
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-block ${
                        smsAnalysis.encoding === "GSM-7"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {smsAnalysis.encoding}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {smsAnalysis.encoding === "GSM-7" ? "Standard" : "Unicode"}
                    </span>
                  </div>
                </div>

                {/* Segments Metric */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Estimated Segments
                  </span>
                  <span
                    id="preview-segments-badge"
                    className={`text-xs font-semibold ${
                      smsAnalysis.exceedsSingleSegment
                        ? "text-rose-600 font-bold"
                        : "text-slate-800"
                    }`}
                  >
                    {smsAnalysis.segments} {smsAnalysis.segments === 1 ? "segment" : "segments"}
                  </span>
                </div>
              </div>

              {/* Character Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700">Length</span>
                  <span
                    id="preview-character-counter"
                    className="font-mono font-bold text-slate-900"
                  >
                    {smsAnalysis.characterCount} / {smsAnalysis.singleSegmentLimit} chars
                  </span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      smsAnalysis.exceedsSingleSegment
                        ? "bg-rose-500"
                        : smsAnalysis.characterCount >= smsAnalysis.singleSegmentLimit * 0.9
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (smsAnalysis.characterCount / smsAnalysis.singleSegmentLimit) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Multi-segment warning if exceeded */}
              {smsAnalysis.exceedsSingleSegment && (
                <div
                  id="preview-segment-warning"
                  className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center space-x-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>
                    Exceeds single SMS segment limit ({smsAnalysis.singleSegmentLimit} chars). Telecommunication networks will bill this message as {smsAnalysis.segments} segments.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
