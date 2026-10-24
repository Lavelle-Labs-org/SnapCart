"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { normalizeEthiopianPhone } from "@order-by-sms/contracts";

export interface LoginValidationErrors {
  phone?: string;
  password?: string;
}

/**
 * Pure validation helper for login inputs.
 */
export function validateLoginForm(values: {
  phone?: string;
  password?: string;
}): { isValid: boolean; errors: LoginValidationErrors; normalizedPhone?: string } {
  const errors: LoginValidationErrors = {};

  const phoneVal = normalizeEthiopianPhone(values.phone || "");
  if (!phoneVal.isValid) {
    errors.phone =
      phoneVal.error ||
      "Please enter a valid Ethiopian mobile number (09... or 07...)";
  }

  const pwd = values.password || "";
  if (!pwd.trim()) {
    errors.password = "Password is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedPhone: phoneVal.isValid ? phoneVal.normalized : undefined,
  };
}

/**
 * Submits the login POST request to /api/auth/login.
 */
export async function submitLogin(
  credentials: { phone: string; password: string },
  fetchFn: typeof fetch = fetch
) {
  const res = await fetchFn("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || "Invalid phone number or password. Please try again."
    );
  }

  return data;
}

export function LoginForm() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginValidationErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateLoginForm({ phone, password });
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await submitLogin(
        {
          phone: validation.normalizedPhone || phone,
          password,
        },
        fetch
      );

      setSuccessNotice("Signed in successfully! Redirecting to dashboard...");

      // Small delay for user reassurance, then navigate
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard";
        } else {
          router.push("/dashboard");
        }
      }, 500);
    } catch (err: any) {
      // Clear error password field for security, but PRESERVE phone input as required by AC
      setPassword("");
      setErrorMessage(
        err.message || "Invalid phone number or password. Please check your credentials."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm transition-colors duration-200">
      {/* Brand Header */}
      <div className="flex items-center space-x-2 mb-6">
        <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-xs">
          <MessageSquare className="w-5 h-5" />
        </div>
        <span className="font-bold text-xl text-slate-900 dark:text-slate-100">Order-by-SMS</span>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Seller Sign In</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
        Access your orders, message audit logs, and settings.
      </p>

      {/* Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mt-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs p-3.5 rounded-xl flex items-start space-x-2 text-left"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
          <span className="flex-1 font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Success Notice */}
      {successNotice && (
        <div
          role="status"
          className="mt-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs p-3.5 rounded-xl flex items-start space-x-2 text-left"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <span className="flex-1 font-medium">{successNotice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="phone"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
          >
            Registered Phone Number
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
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
              fieldErrors.phone
                ? "border-rose-300 dark:border-rose-800 focus:ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 placeholder:text-rose-300"
                : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            } disabled:opacity-60`}
          />
          {fieldErrors.phone && (
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
              {fieldErrors.phone}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
          >
            Password
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
            disabled={isSubmitting}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] transition focus:outline-none focus:ring-2 ${
              fieldErrors.password
                ? "border-rose-300 dark:border-rose-800 focus:ring-rose-400 bg-rose-50/20 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 placeholder:text-rose-300"
                : "border-slate-300 dark:border-slate-700 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            } disabled:opacity-60`}
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
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
        New seller?{" "}
        <Link
          href="/signup"
          className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
        >
          Register shop
        </Link>
      </p>
    </div>
  );
}
