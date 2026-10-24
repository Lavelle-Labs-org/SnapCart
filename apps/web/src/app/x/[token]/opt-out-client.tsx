"use client";

import React, { useState } from "react";
import { BellOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { OptOutResponse } from "@order-by-sms/contracts";

export interface OptOutPreviewData {
  orderNumber?: number;
  shopName?: string;
  alreadySuppressed?: boolean;
}

export type OptOutStatus =
  | "idle"
  | "submitting"
  | "success"
  | "already_suppressed"
  | "error";

interface OptOutClientProps {
  token: string;
  initialData?: OptOutPreviewData | null;
}

/**
 * Pure helper: determine initial component status based on preview metadata.
 */
export function getOptOutInitialState(
  initialData?: OptOutPreviewData | null
): OptOutStatus {
  return initialData?.alreadySuppressed ? "already_suppressed" : "idle";
}

/**
 * Pure helper: get safe confirmation message without exposing personal details.
 */
export function getConfirmationMessage(status: OptOutStatus): string {
  if (status === "already_suppressed") {
    return "Your phone number is already opted out. You will not receive text messages for this order.";
  }
  return "You will no longer receive SMS notifications for this order. Your order is still being processed and will be fulfilled as normal.";
}

/**
 * Submits the opt-out POST request to /api/stop/[token].
 */
export async function submitOptOut(
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<OptOutResponse> {
  const res = await fetchFn(`/api/stop/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message ||
        "Failed to stop SMS updates. The link may be invalid or expired."
    );
  }

  return data;
}

export function OptOutClient({ token, initialData }: OptOutClientProps) {
  const [status, setStatus] = useState<OptOutStatus>(
    getOptOutInitialState(initialData)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOptOut = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      status === "submitting" ||
      status === "success" ||
      status === "already_suppressed"
    ) {
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const data = await submitOptOut(token, fetch);

      if (data.alreadySuppressed) {
        setStatus("already_suppressed");
      } else {
        setStatus("success");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error. Please try again.");
      setStatus("error");
    }
  };

  // Render Success / Already Suppressed State
  if (status === "success" || status === "already_suppressed") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center max-w-md mx-auto border-x border-slate-200 p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-bold text-slate-900">
          {status === "already_suppressed"
            ? "SMS Updates Already Stopped"
            : "Text Updates Stopped"}
        </h1>

        <p className="text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
          {getConfirmationMessage(status)}
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 text-left w-full mt-6 shadow-sm">
          <p className="font-semibold mb-1">What happens next?</p>
          <p>
            Your order is active with the seller
            {initialData?.shopName ? ` (${initialData.shopName})` : ""}. Please
            check with the shop counter directly or refer to your order number
            for pickup.
          </p>
        </div>

        <p className="text-xs text-slate-400 mt-6">
          Safe & Private: Your notification preferences have been updated.
        </p>
      </div>
    );
  }

  // Render Idle / Error / Submitting State
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center max-w-md mx-auto border-x border-slate-200 p-6 text-center">
      <div className="w-16 h-16 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center mb-4 shadow-sm">
        <BellOff className="w-8 h-8" />
      </div>

      <h1 className="text-xl font-bold text-slate-900">Stop Order SMS Updates</h1>

      {initialData?.orderNumber && (
        <div className="inline-block bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold text-slate-600 mt-2">
          {`Order #${initialData.orderNumber}`}
          {initialData.shopName ? ` • ${initialData.shopName}` : ""}
        </div>
      )}

      <p className="text-sm text-slate-600 mt-2 max-w-xs leading-relaxed">
        If you no longer wish to receive text updates for this order, click below
        to opt out.
      </p>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl p-3 w-full mt-4 flex items-start space-x-2 text-left">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleOptOut} className="mt-6 w-full space-y-3">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold py-3 rounded-xl transition shadow-xs flex items-center justify-center space-x-2 min-h-[48px]"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Stopping text updates...</span>
            </>
          ) : (
            <span>Confirm Stop Text Updates</span>
          )}
        </button>
      </form>

      <p className="text-xs text-slate-400 mt-4 leading-relaxed">
        Your order will still be processed. You can check status directly with the
        seller.
      </p>
    </div>
  );
}
