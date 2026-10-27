"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { normalizeEthiopianPhone } from "@order-by-sms/contracts";
import { useTranslation } from "../../lib/i18n";

export interface SignupValidationErrors {
  business_name?: string;
  sms_name?: string;
  phone?: string;
  password?: string;
}

/**
 * Pure validation helper for Step 1 seller registration inputs.
 */
export function validateSignupForm(values: {
  business_name?: string;
  sms_name?: string;
  phone?: string;
  password?: string;
}): { isValid: boolean; errors: SignupValidationErrors } {
  const errors: SignupValidationErrors = {};

  const bName = values.business_name?.trim() || "";
  if (bName.length < 2) {
    errors.business_name = "Business name must be at least 2 characters";
  } else if (bName.length > 100) {
    errors.business_name = "Business name cannot exceed 100 characters";
  }

  const sName = values.sms_name?.trim() || "";
  if (sName.length < 2) {
    errors.sms_name = "SMS name must be at least 2 characters";
  } else if (sName.length > 20) {
    errors.sms_name = "SMS name cannot exceed 20 characters";
  }

  const phoneVal = normalizeEthiopianPhone(values.phone || "");
  if (!phoneVal.isValid) {
    errors.phone =
      phoneVal.error ||
      "Please enter a valid Ethiopian mobile number (09... or 07...)";
  }

  const pwd = values.password || "";
  if (pwd.length < 10) {
    errors.password = "Password must be at least 10 characters long";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function SignupForm() {
  const router = useRouter();
  const { t, isAmharic } = useTranslation();

  // Step state: 1 = Details, 2 = Phone OTP
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 Form fields
  const [businessName, setBusinessName] = useState("");
  const [smsName, setSmsName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 OTP fields
  const [registeredPhone, setRegisteredPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(60);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Shared UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignupValidationErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // 60-second cooldown timer for Step 2
  useEffect(() => {
    if (step !== 2 || cooldown <= 0) return;

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
  }, [step, cooldown]);

  // Focus OTP input upon entering Step 2
  useEffect(() => {
    if (step === 2 && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  // Handle Step 1 Submit
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateSignupForm({
      business_name: businessName,
      sms_name: smsName,
      phone,
      password,
    });

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const phoneValidation = normalizeEthiopianPhone(phone);
    const normalized = phoneValidation.normalized;

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          sms_name: smsName.trim(),
          phone: normalized,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.message || "Failed to create account. Please check your details."
        );
      }

      setRegisteredPhone(normalized);
      setStep(2);
      setCooldown(60);
      setCode("");
      setIsSubmitting(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Handle Step 2 OTP verification
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const codeVal = (codeToVerify || code).trim();
    if (codeVal.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: registeredPhone,
          code: codeVal,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.message ||
            "Invalid or expired verification code. Please check and try again."
        );
      }

      setSuccessNotice("Phone verified successfully! Redirecting to dashboard...");

      // Small delay for user reassurance, then navigate
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard";
        } else {
          router.push("/dashboard");
        }
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || "Verification failed. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Handle typing OTP code
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, "").slice(0, 6);
    setCode(digitsOnly);
    setErrorMessage(null);

    if (digitsOnly.length === 6 && !isSubmitting) {
      handleVerifyOtp(digitsOnly);
    }
  };

  // Handle Resend Code
  const handleResendCode = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName.trim(),
          sms_name: smsName.trim(),
          phone: registeredPhone,
          password,
        }),
      });

      if (!res.ok) {
        // If phone already registered, OTP is still active in SMSHub
      }

      setCooldown(60);
      setSuccessNotice("New verification code requested.");
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch {
      setErrorMessage("Could not resend code. Please wait a moment and try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm transition-colors duration-200">
      {/* Step Indicator Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
          Step {step} of 2
        </span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {step === 1 ? t.auth.signupTitle : t.auth.otpTitle}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        {step === 1
          ? t.auth.signupSubtitle
          : t.auth.otpSubtitle(registeredPhone || phone)}
      </p>

      {/* Shared Feedback Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3.5 rounded-xl flex items-start space-x-2 text-left"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <span className="flex-1 font-medium">{errorMessage}</span>
        </div>
      )}

      {successNotice && (
        <div
          role="status"
          className="mt-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs p-3.5 rounded-xl flex items-start space-x-2 text-left"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <span className="flex-1 font-medium">{successNotice}</span>
        </div>
      )}

      {/* STEP 1: Details Entry */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="business_name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Business Name
            </label>
            <input
              id="business_name"
              type="text"
              name="business_name"
              value={businessName}
              onChange={(e) => {
                setBusinessName(e.target.value);
                if (fieldErrors.business_name) {
                  setFieldErrors((prev) => ({ ...prev, business_name: undefined }));
                }
              }}
              placeholder="e.g. Habesha Cafe & Bakery"
              required
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                fieldErrors.business_name
                  ? "border-rose-300 dark:border-rose-800 focus:ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 placeholder:text-rose-300"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              }`}
            />
            {fieldErrors.business_name && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                {fieldErrors.business_name}
              </p>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="sms_name"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
              >
                SMS Sender Name
              </label>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {smsName.length}/20 chars
              </span>
            </div>
            <input
              id="sms_name"
              type="text"
              name="sms_name"
              maxLength={20}
              value={smsName}
              onChange={(e) => {
                setSmsName(e.target.value);
                if (fieldErrors.sms_name) {
                  setFieldErrors((prev) => ({ ...prev, sms_name: undefined }));
                }
              }}
              placeholder="e.g. Habesha Cafe"
              required
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                fieldErrors.sms_name
                  ? "border-rose-300 dark:border-rose-800 focus:ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 placeholder:text-rose-300"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              }`}
            />
            {fieldErrors.sms_name ? (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                {fieldErrors.sms_name}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Prefix on all buyer order updates (e.g. &quot;Habesha Cafe: order #1001...&quot;).
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Mobile Phone (Alert Number)
            </label>
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
              placeholder="09... or 07..."
              required
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                fieldErrors.phone
                  ? "border-rose-300 dark:border-rose-800 focus:ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 placeholder:text-rose-300"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              }`}
            />
            {fieldErrors.phone ? (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                {fieldErrors.phone}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Order alerts with 1-tap accept/ready action links will be sent here.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Password (Min 10 characters)
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="••••••••••"
              required
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
                fieldErrors.password
                  ? "border-rose-300 dark:border-rose-800 focus:ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 placeholder:text-rose-300"
                  : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              }`}
            />
            {fieldErrors.password && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-3 rounded-xl transition shadow-xs mt-6 min-h-[48px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating account & sending code...</span>
              </>
            ) : (
              <>
                <span>Verify Phone & Create Shop</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: OTP Verification */}
      {step === 2 && (
        <div className="mt-6 space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold">{registeredPhone}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrorMessage(null);
              }}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium underline text-xs"
            >
              Change number
            </button>
          </div>

          {/* 6-Digit Code Input */}
          <div className="space-y-2">
            <label
              htmlFor="otp-code"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-center"
            >
              Enter 6-Digit Code
            </label>
            <input
              id="otp-code"
              ref={otpInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={handleCodeChange}
              disabled={isSubmitting}
              className="w-full text-center text-3xl font-mono tracking-[0.4em] py-3.5 border-2 rounded-xl transition focus:outline-none border-slate-300 dark:border-slate-700 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-950/40 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
              aria-label="6-Digit Verification Code"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-400 text-center">
              Enter the 6 digits texted to your alert phone number
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleVerifyOtp()}
            disabled={isSubmitting || code.length !== 6}
            className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-medium py-3 rounded-xl transition shadow-xs min-h-[48px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isAmharic ? t.otp.verifying : "Verifying code..."}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>{isAmharic ? t.auth.otpVerifyBtn : "Verify & Complete Signup"}</span>
              </>
            )}
          </button>

          {/* Resend Controls */}
          <div className="pt-2 text-center">
            {cooldown > 0 ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isAmharic ? t.otp.resendCooldown(cooldown) : `Resend code in ${cooldown}s`}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium underline"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isAmharic ? "በመላክ ላይ..." : "Resending..."}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{isAmharic ? t.auth.otpResendBtn : "Resend Code"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer Link */}
      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
        {isAmharic ? t.auth.haveAccount : "Already have an account?"}{" "}
        <Link href="/login" className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
          {isAmharic ? t.auth.loginLink : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
