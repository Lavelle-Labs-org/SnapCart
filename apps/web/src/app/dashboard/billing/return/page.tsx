"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ArrowRight,
  Zap,
} from "lucide-react";

function BillingReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const txRef = searchParams.get("tx_ref") || searchParams.get("mock_tx_ref");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!txRef) {
      setError("No transaction reference detected.");
      setLoading(false);
      return;
    }

    const verifyPayment = async () => {
      try {
        const res = await fetch(`/api/billing/verify/${encodeURIComponent(txRef)}`);
        const data = await res.json();

        const payload = data.data || data;

        if (res.ok && payload.status === "completed") {
          setSuccess(true);
          setNewBalance(payload.newBalance);
        } else {
          // If still pending, wait 1.5s and try once more before showing status
          setTimeout(async () => {
            try {
              const retryRes = await fetch(`/api/billing/verify/${encodeURIComponent(txRef)}`);
              const retryRaw = await retryRes.json();
              const retryData = retryRaw.data || retryRaw;
              if (retryRes.ok && retryData.status === "completed") {
                setSuccess(true);
                setNewBalance(retryData.newBalance);
              } else {
                setError(retryData.message || "Payment verification pending. If money was deducted, balance will update within a few moments.");
              }
            } catch {
              setError("Network error while verifying transaction.");
            } finally {
              setLoading(false);
            }
          }, 1500);
          return;
        }
      } catch (err: any) {
        setError(err.message || "Failed to reach payment verification service.");
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [txRef]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl text-center">
        {loading ? (
          <div className="py-8 space-y-4">
            <RotateCw className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Verifying Payment with Chapa...
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Confirming transaction reference <span className="font-mono">{txRef}</span>
            </p>
          </div>
        ) : success ? (
          <div className="py-4 space-y-5">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Top-Up Successful!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Your payment was confirmed and SMS credits have been credited to your shop.
              </p>
            </div>

            {newBalance !== null && (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  New Credit Balance
                </span>
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center justify-center gap-1.5">
                  <Zap className="w-6 h-6 fill-emerald-500" />
                  <span>{newBalance} SMS</span>
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2">
              <Link
                href="/dashboard"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                <span>Go to Orders Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard/billing"
                className="block text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 py-1"
              >
                View Transaction History
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-5">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Payment Status Update
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {error || "We could not immediately verify this transaction."}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
              >
                <RotateCw className="w-4 h-4" />
                <span>Check Again</span>
              </button>
              <Link
                href="/dashboard/billing"
                className="block text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 py-1"
              >
                Return to Billing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <RotateCw className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      }
    >
      <BillingReturnContent />
    </Suspense>
  );
}
