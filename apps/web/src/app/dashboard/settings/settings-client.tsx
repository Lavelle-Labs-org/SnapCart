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
  Upload,
  Trash2,
  Image as ImageIcon,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  calculateSmsSegments,
  detectEncoding,
  SMS_TEMPLATES,
} from "@order-by-sms/contracts";
import { useTranslation } from "../../../lib/i18n";

export interface SellerSettingsData {
  id: string;
  businessName: string;
  smsName: string;
  slug: string;
  phone: string;
  logoUrl?: string | null;
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
  const { t, isAmharic } = useTranslation();
  const [businessName, setBusinessName] = useState(initialSeller.businessName || "");
  const [smsName, setSmsName] = useState(initialSeller.smsName || "");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>("buyerAccepted");
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");

  // Storefront Profile Picture / Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(initialSeller.logoUrl ?? null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);
  const [logoStatus, setLogoStatus] = useState<"idle" | "success" | "error">("idle");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "success" | "error">("idle");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setLogoStatus("error");
      setLogoMessage("Please select a JPEG, PNG, WebP, or AVIF image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setLogoStatus("error");
      setLogoMessage("Image size must not exceed 5MB.");
      return;
    }

    setIsUploadingLogo(true);
    setLogoStatus("idle");
    setLogoMessage(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetchFn("/api/settings/profile-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error?.message || "Failed to upload profile picture.");
      }

      const sellerPayload = data?.data?.seller || data?.seller;
      const newLogo = sellerPayload?.logoUrl ?? sellerPayload?.logo_url ?? null;
      setLogoUrl(newLogo);
      setLogoStatus("success");
      setLogoMessage(t.settings.photoSuccess);
    } catch (err: any) {
      setLogoStatus("error");
      setLogoMessage(err?.message || "Failed to upload profile picture.");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLogoDelete = async () => {
    if (!logoUrl || isDeletingLogo) return;

    setIsDeletingLogo(true);
    setLogoStatus("idle");
    setLogoMessage(null);

    try {
      const res = await fetchFn("/api/settings/profile-image", {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || data?.error?.message || "Failed to remove profile picture.");
      }

      setLogoUrl(null);
      setLogoStatus("success");
      setLogoMessage(t.settings.photoRemoved);
    } catch (err: any) {
      setLogoStatus("error");
      setLogoMessage(err?.message || "Failed to remove profile picture.");
    } finally {
      setIsDeletingLogo(false);
    }
  };

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordStatus("error");
      setPasswordMessage(isAmharic ? "እባክዎ አሁን ያለዎትን የይለፍ ቃል ያስገቡ" : "Please enter your current password");
      return;
    }

    if (newPassword.length < 10) {
      setPasswordStatus("error");
      setPasswordMessage(isAmharic ? t.settings.passwordMinLength : "New password must be at least 10 characters long");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordStatus("error");
      setPasswordMessage(isAmharic ? t.settings.passwordMismatch : "New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    setPasswordStatus("idle");

    try {
      const res = await fetchFn("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.message ||
          data?.error?.message ||
          (isAmharic ? "የይለፍ ቃል መቀየር አልተቻለም" : "Failed to update password")
        );
      }

      setPasswordStatus("success");
      setPasswordMessage(isAmharic ? t.settings.passwordSuccess : "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        setPasswordStatus("idle");
        setPasswordMessage(null);
      }, 5000);
    } catch (err: any) {
      setPasswordStatus("error");
      setPasswordMessage(
        err?.message ||
        (isAmharic ? "የይለፍ ቃል መቀየር አልተቻለም" : "Failed to update password")
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isAmharic ? t.settings.title : "Shop Settings"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isAmharic ? t.settings.subtitle : "Manage your shop identity, storefront link, and SMS notification settings."}
        </p>
      </div>

      {/* Storefront Link Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>{isAmharic ? t.settings.storefrontLinkTitle : "Storefront Link"}</span>
          </h2>
          <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            {isAmharic ? "ንቁ ካታሎግ" : "Active Catalog"}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {isAmharic ? t.settings.storefrontLinkDesc : "Share this direct link on Telegram or Instagram for customers to browse and order without an app."}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            id="storefront-link-input"
            type="text"
            readOnly
            value={storefrontUrl}
            className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <div className="flex items-center gap-2">
            <button
              id="copy-storefront-btn"
              type="button"
              onClick={handleCopy}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition min-h-[40px] shadow-xs ${
                isCopied
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
              }`}
            >
              {isCopied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isAmharic ? t.settings.copiedBtn : "Copied!"}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isAmharic ? t.settings.copyLinkBtn : "Copy Link"}</span>
                </>
              )}
            </button>

            <a
              id="open-storefront-link"
              href={storefrontUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open storefront in new tab"
              className="flex items-center justify-center p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition min-h-[40px] min-w-[40px]"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-6 space-y-6">
          {/* Profile Picture Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                <span>{isAmharic ? t.settings.profilePictureTitle : "Storefront Profile Picture"}</span>
              </h2>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAmharic ? t.settings.profilePictureSubtitle : "Upload a logo or profile image for your public storefront header."}
            </p>

            {logoMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  logoStatus === "error"
                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {logoStatus === "error" ? (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                )}
                <span>{logoMessage}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <div className="relative group flex-shrink-0">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    id="profile-picture-preview"
                    src={logoUrl}
                    alt={businessName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500/20 shadow-md bg-white"
                  />
                ) : (
                  <div
                    id="profile-picture-placeholder"
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-extrabold flex items-center justify-center text-2xl shadow-md select-none"
                  >
                    {(smsName || businessName || "S").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="profile-picture-file-input"
                  />
                  <button
                    type="button"
                    id="upload-profile-picture-btn"
                    disabled={isUploadingLogo || isDeletingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-semibold rounded-xl shadow-xs transition min-h-[38px]"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{isAmharic ? t.settings.uploadingPhoto : "Uploading..."}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{isAmharic ? t.settings.uploadPhotoBtn : "Upload Photo"}</span>
                      </>
                    )}
                  </button>

                  {logoUrl && (
                    <button
                      type="button"
                      id="remove-profile-picture-btn"
                      disabled={isUploadingLogo || isDeletingLogo}
                      onClick={handleLogoDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-800 transition min-h-[38px]"
                    >
                      {isDeletingLogo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>{isAmharic ? t.settings.removePhotoBtn : "Remove"}</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAmharic ? t.settings.photoHelp : "PNG, JPG, WebP or AVIF up to 5MB. Stored securely."}
                </p>
              </div>
            </div>
          </div>

          <form
            id="shop-settings-form"
            onSubmit={handleSave}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {isAmharic ? t.settings.brandingTitle : "Shop & SMS Branding"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAmharic ? t.settings.brandingSubtitle : "Saved values appear at the beginning of all outgoing SMS alerts."}
              </p>
            </div>

            {/* Business Name Field */}
            <div>
              <label
                htmlFor="business-name-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                {isAmharic ? t.settings.businessNameLabel : "Business Name"}
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
                placeholder={isAmharic ? "ምሳሌ፡ ሀበሻ ካፌ እና ዳቦ ቤት" : "e.g. Habesha Cafe & Bakery"}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                  !isBusinessNameValid && businessName.length > 0
                    ? "border-rose-300 focus:ring-rose-400 bg-rose-50/20 text-rose-900 dark:text-rose-200"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1 px-1">
                <span>{isAmharic ? t.settings.businessNameHelp : "Full name shown on web storefront"}</span>
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
                  {isAmharic ? t.settings.smsNameLabel : "SMS Sender Name"}
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
                placeholder={isAmharic ? "ምሳሌ፡ ሀበሻ ካፌ" : "e.g. Habesha Cafe"}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                  smsName.length > 20
                    ? "border-rose-400 focus:ring-rose-400 bg-rose-50/30 text-rose-900 dark:text-rose-200"
                    : smsNameHasNonGsm
                    ? "border-amber-400 focus:ring-amber-500 bg-amber-50/20 text-slate-900 dark:text-slate-100"
                    : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              />

              <div className="text-[11px] text-slate-500 mt-1 px-1">
                {isAmharic ? t.settings.smsNameHelp : "Max 20 characters. Precedes every SMS message (e.g. \"Habesha Cafe: ...\")."}
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
                  <span>{isAmharic ? t.settings.savingBtn : "Saving Changes..."}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isAmharic ? t.settings.saveBtn : "Save Settings"}</span>
                </>
              )}
            </button>
          </form>

          {/* Security & Password Card */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-emerald-600" />
                <span>{isAmharic ? t.settings.securitySection : "Security & Password"}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isAmharic ? t.settings.securitySubtitle : "Update your seller dashboard account login password."}
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4" noValidate>
              {/* Current Password Field */}
              <div>
                <label
                  htmlFor="current-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                >
                  {isAmharic ? t.settings.currentPassword : "Current Password"}
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (passwordStatus === "error") setPasswordStatus("idle");
                    }}
                    placeholder={isAmharic ? t.settings.currentPasswordPlaceholder : "••••••••••"}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-h-[44px]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                >
                  {isAmharic ? t.settings.newPassword : "New Password"}
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordStatus === "error") setPasswordStatus("idle");
                    }}
                    placeholder={isAmharic ? t.settings.newPasswordPlaceholder : "••••••••••"}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-h-[44px]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    aria-label={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p
                  className={`text-[11px] mt-1 transition-colors ${
                    newPassword.length > 0 && newPassword.length < 10
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : newPassword.length >= 10
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {isAmharic
                    ? newPassword.length >= 10
                      ? "✓ የይለፍ ቃል ርዝመት ተሟልቷል"
                      : "ቢያንስ 10 ፊደላት ወይም ቁጥሮች መሆን አለበት"
                    : newPassword.length >= 10
                    ? "✓ Minimum 10 characters satisfied"
                    : "Must be at least 10 characters long"}
                </p>
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
                >
                  {isAmharic ? t.settings.confirmNewPassword : "Confirm New Password"}
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => {
                      setConfirmNewPassword(e.target.value);
                      if (passwordStatus === "error") setPasswordStatus("idle");
                    }}
                    placeholder={isAmharic ? t.settings.confirmPasswordPlaceholder : "••••••••••"}
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 min-h-[44px]"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmNewPassword.length > 0 && (
                  <p
                    className={`text-[11px] mt-1 font-medium ${
                      confirmNewPassword === newPassword
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {confirmNewPassword === newPassword
                      ? isAmharic
                        ? "✓ የይለፍ ቃሎች ተዛምደዋል"
                        : "✓ Passwords match"
                      : isAmharic
                      ? t.settings.passwordMismatch
                      : "Passwords do not match"}
                  </p>
                )}
              </div>

              {passwordStatus === "success" && (
                <div
                  id="password-success-banner"
                  className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <span>{passwordMessage}</span>
                </div>
              )}

              {passwordStatus === "error" && (
                <div
                  id="password-error-banner"
                  className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center space-x-2 text-xs text-rose-800 dark:text-rose-300"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                  <span>{passwordMessage}</span>
                </div>
              )}

              <button
                id="change-password-btn"
                type="submit"
                disabled={
                  isChangingPassword ||
                  !currentPassword ||
                  newPassword.length < 10 ||
                  newPassword !== confirmNewPassword
                }
                className="w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl font-medium text-sm transition min-h-[44px] shadow-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isAmharic ? t.settings.updatingPassword : "Updating..."}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{isAmharic ? t.settings.updatePassword : "Change Password"}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Live Preview Column */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>{isAmharic ? t.settings.previewTitle : "Live SMS Template Previewer"}</span>
              </h2>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAmharic ? t.settings.previewSubtitle : "Preview outgoing SMS templates before customers receive them:"}
            </p>

            {/* Template Selector Tabs */}
            <div
              id="template-picker-tabs"
              className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              {TEMPLATE_OPTIONS.map((tmpl) => {
                const isActive = selectedTemplate === tmpl.key;
                const localizedLabel = isAmharic
                  ? tmpl.key === "buyerAccepted"
                    ? t.settings.tmplOrderAccepted
                    : tmpl.key === "buyerReady"
                    ? t.settings.tmplOrderReady
                    : tmpl.key === "buyerRejected"
                    ? t.settings.tmplOrderDeclined
                    : tmpl.key === "buyerNewPickupCode"
                    ? t.settings.tmplPickupVerified
                    : t.settings.tmplOrderPlaced
                  : tmpl.label;
                const localizedRecipient = isAmharic
                  ? tmpl.recipient === "Buyer"
                    ? t.settings.toCustomer
                    : t.settings.toSeller
                  : `To: ${tmpl.recipient}`;

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
                    <span className="truncate">{localizedLabel}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-normal">
                      {localizedRecipient}
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
                  <span>{isAmharic ? t.settings.outboundBubbleTitle : "Outbound SMS Bubble"}</span>
                </span>
                <span>{isAmharic ? t.settings.gatewayCarriers : "Ethio / Safaricom Gateway"}</span>
              </div>

              {/* Message Bubble */}
              <div className="bg-emerald-600 text-white p-3.5 rounded-xl rounded-tl-sm text-xs font-mono leading-relaxed break-words whitespace-pre-wrap select-all shadow-xs">
                <span id="rendered-sms-preview">{renderedMessage}</span>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                {isAmharic ? t.settings.legalSignatureNotice : "+ Default verified legal signature (~25 chars) appended by SMSHub upon dispatch"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
