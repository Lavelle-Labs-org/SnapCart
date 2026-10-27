"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useTranslation } from "../../../../../lib/i18n";
import { LanguageToggle } from "../../../../../components/language-toggle";
import { ThemeToggle } from "../../../../../components/theme-toggle";

interface VerifyOtpFormProps {
  slug: string;
  draftId: string;
  phone: string;
  lastSentAt?: string | null;
}

export function VerifyOtpForm({
  slug,
  draftId,
  phone,
  lastSentAt,
}: VerifyOtpFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, isAmharic } = useTranslation();

  // Compute initial cooldown based on lastSentAt timestamp
  const calculateInitialCooldown = () => {
    if (!lastSentAt) return 60;
    try {
      const elapsed = Math.floor(
        (Date.now() - new Date(lastSentAt).getTime()) / 1000
      );
      return Math.max(0, 60 - elapsed);
    } catch {
      return 60;
    }
  };

  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(calculateInitialCooldown);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Focus input automatically on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Cooldown timer interval
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Mask phone for privacy and clarity: e.g. 0911223344 -> 0911 ••• 344
  const formatDisplayPhone = (rawPhone: string) => {
    if (rawPhone.length >= 10) {
      const start = rawPhone.slice(0, 4);
      const end = rawPhone.slice(-3);
      return `${start} ••• ${end}`;
    }
    return rawPhone;
  };

  // Submit verification code to API
  const handleVerify = async (codeToVerify: string) => {
    const trimmedCode = codeToVerify.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrorMessage("Please enter the complete 6-digit code.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId,
          code: trimmedCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "Invalid or expired verification code. Please check and try again.";
        setErrorMessage(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // Order created successfully!
      // Clear client cart from localStorage
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem(`snapcart_cart_${slug}`);
          localStorage.removeItem(`order_by_sms_cart_${slug}`);
        }
      } catch {
        // Ignore localStorage clear errors
      }

      const orderNumber = data.orderNumber ?? data.data?.orderNumber ?? "";
      const orderId = data.orderId ?? data.data?.orderId ?? "";
      const smsConsent =
        data.order?.smsConsent ??
        data.order?.sms_consent ??
        data.smsConsent ??
        data.sms_consent;

      const consentParam =
        smsConsent !== undefined ? `&consent=${smsConsent ? "true" : "false"}` : "";

      const targetUrl = `/s/${slug}/done?orderId=${encodeURIComponent(
        orderId
      )}&orderNumber=${encodeURIComponent(orderNumber)}${consentParam}`;

      router.push(targetUrl);
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Network error. Please check your connection and try again."
      );
      setIsSubmitting(false);
    }
  };

  // Handle user typing into OTP input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, "").slice(0, 6);
    setCode(digitsOnly);
    setErrorMessage(null);

    // Auto-trigger when exactly 6 digits are typed
    if (digitsOnly.length === 6 && !isSubmitting) {
      handleVerify(digitsOnly);
    }
  };

  // Resend OTP code
  const handleResend = async () => {
    if (cooldown > 0 || isResending || isSubmitting) return;

    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/checkout/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "Failed to resend code. Please try again shortly.";
        setErrorMessage(errorMsg);

        if (data?.retryAfter) {
          setCooldown(data.retryAfter);
        }
        setIsResending(false);
        return;
      }

      // Successful resend: reset 60-second cooldown
      const retryAfter = data?.retryAfter ?? data?.data?.retryAfter ?? 60;
      setCooldown(retryAfter);
      setSuccessMessage("New 6-digit verification code sent via SMS.");
      setCode("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Network error while requesting new code. Please try again."
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200 dark:border-slate-800 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 gap-2 transition-colors duration-200">
        <div className="flex items-center space-x-2">
          <Link
            href={`/s/${slug}/checkout`}
            className="p-2 -ml-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Back to Checkout"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {isAmharic ? "ስልክ ቁጥር ማረጋገጫ" : "Verify Phone Number"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      {/* Main Verification Card */}
      <main className="p-6 text-center space-y-6 flex-1 flex flex-col justify-center">
        {/* Top Icon Badge */}
        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <MessageSquare className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {isAmharic ? "ባለ 6 ድጂት ኮድ ያስገቡ" : "Enter 6-Digit Code"}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            {isAmharic ? (
              <>
                የትዕዛዝ ማረጋገጫ ኮድ ወደ{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatDisplayPhone(phone)}
                </span>{" "}
                በኤስኤምኤስ ልከናል
              </>
            ) : (
              <>
                We texted a 6-digit confirmation code to{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatDisplayPhone(phone)}
                </span>
                . Enter it below to confirm your order in a snap.
              </>
            )}
          </p>
          <div className="mt-1">
            <Link
              href={`/s/${slug}/checkout`}
              className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline font-medium min-h-[44px]"
            >
              {isAmharic ? "ስልክ ቁጥሩ ተሳስቷል? አስተካክል" : "Wrong number? Edit checkout"}
            </Link>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMessage && (
          <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3.5 rounded-xl flex items-start space-x-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs p-3.5 rounded-xl flex items-start space-x-2 text-left">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1 font-medium">{successMessage}</span>
          </div>
        )}

        {/* 6-Digit Numeric Input */}
        <div className="max-w-xs mx-auto w-full space-y-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className={`w-full text-center text-3xl font-mono tracking-[0.4em] py-3.5 border-2 rounded-xl transition duration-150 focus:outline-none ${
                errorMessage
                  ? "border-rose-400 dark:border-rose-500 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100 placeholder-rose-300 dark:placeholder-rose-700"
                  : "border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-950/50 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600"
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              aria-label="6-Digit Verification Code"
            />
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {isAmharic
              ? "በኤስኤምኤስ የደረሰዎትን ባለ 6 ዲጂት ቁጥር ያስገቡ"
              : "Enter the 6-digit numeric code from your text message"}
          </p>
        </div>

        {/* Cooldown Timer & Resend Controls */}
        <div className="pt-2">
          {cooldown > 0 ? (
            <div className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-full text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>
                {isAmharic ? (
                  <>
                    ኮድ በድጋሚ ለመላክ{" "}
                    <span className="font-bold text-slate-900 dark:text-slate-100">{cooldown} ሰከንድ</span>
                  </>
                ) : (
                  <>
                    Resend code in{" "}
                    <span className="font-bold text-slate-900 dark:text-slate-100">{cooldown}s</span>
                  </>
                )}
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAmharic ? "ኮዱ አልደረሰዎትም?" : "Didn't receive the code?"}
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || isSubmitting}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 py-2.5 px-4 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition disabled:opacity-50 min-h-[44px]"
              >
                {isResending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAmharic ? "ኮድ እየተላከ ነው..." : "Resending code..."}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isAmharic ? "ኮድ በድጋሚ በኤስኤምኤስ ላክ" : "Resend Code via SMS"}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Informational security reassurance */}
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-900 border border-transparent dark:border-slate-800 p-3 rounded-lg mt-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>
            {isAmharic
              ? "በSnapcart የተረጋገጠ • ኮዱ የሚያገለግለው ለ 5 ደቂቃ ብቻ ነው። የይለፍ ቃል አያስፈልግም።"
              : "Snapcart verified • Code expires in 5 minutes • No password needed"}
          </span>
        </div>
      </main>

      {/* Footer CTA Button */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 sticky bottom-0 z-10 transition-colors duration-200">
        <button
          type="button"
          onClick={() => handleVerify(code)}
          disabled={code.length !== 6 || isSubmitting}
          className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white font-medium px-5 py-3.5 rounded-xl transition shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{isAmharic ? "እያረጋገጠ ነው..." : "Verifying & Placing Order..."}</span>
            </>
          ) : (
            <span>{isAmharic ? "አረጋግጥና እዘዝ" : "Confirm & Seal Order"}</span>
          )}
        </button>
      </footer>
    </div>
  );
}
