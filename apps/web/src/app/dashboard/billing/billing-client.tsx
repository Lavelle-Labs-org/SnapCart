"use client";

import React, { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
  Receipt,
  RotateCw,
  Clock,
  Check,
} from "lucide-react";
import {
  BILLING_PACKAGES,
  BillingPackage,
  BillingBalanceDto,
  PaymentTransactionDto,
} from "@order-by-sms/contracts";

export function BillingClient() {
  const [balance, setBalance] = useState<BillingBalanceDto | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBillingData = async () => {
    try {
      const [balRes, txRes] = await Promise.all([
        fetch("/api/billing/balance"),
        fetch("/api/billing/transactions"),
      ]);

      if (balRes.ok) {
        const balData = await balRes.json();
        setBalance(balData.data || balData);
      }
      if (txRes.ok) {
        const txData = await txRes.json();
        const txList = Array.isArray(txData)
          ? txData
          : Array.isArray(txData?.data)
            ? txData.data
            : [];
        setTransactions(txList);
      }
    } catch {
      setErrorMessage("Could not load billing information. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const handleBuyPackage = async (pkg: BillingPackage) => {
    setPurchasingId(pkg.id);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const data = await res.json();
      const checkoutUrl = data.checkoutUrl || data.data?.checkoutUrl;
      if (!res.ok || !checkoutUrl) {
        throw new Error(
          data.message ||
            data.error?.message ||
            "Failed to initialize Chapa checkout session"
        );
      }

      // Redirect seller to Chapa hosted payment page
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setErrorMessage(err.message || "Payment initialization failed. Please try again.");
      setPurchasingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm tracking-wide uppercase">
          <Zap className="w-4 h-4" />
          <span>Billing & SMS Credits</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
          SMS Balance & Top-Up
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl">
          Order-by-SMS uses metered SMS credits to notify your customers of order status, pickup codes, and acceptance in real time via Ethio telecom.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">Unable to process request</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/80 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Remaining Credits</span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                (balance?.smsCredits ?? 0) > 3
                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                  : (balance?.smsCredits ?? 0) > 0
                  ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                  : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
              }`}
            >
              {(balance?.smsCredits ?? 0) > 0 ? "Active" : "Trial Expired"}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-100">
              {loading ? "..." : balance?.smsCredits ?? 0}
            </span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              SMS
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {(balance?.smsCredits ?? 0) <= 0
              ? "Your credits are exhausted. Buyer orders will still succeed, but customer SMS updates are paused."
              : (balance?.smsCredits ?? 0) <= 3
              ? "Running low! Recharge soon to avoid SMS interruptions."
              : "Enough credits for standard store operation."}
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Total SMS Dispatched</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-100">
              {loading ? "..." : balance?.smsCreditsUsed ?? 0}
            </span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Sent
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Real SMS messages delivered to buyers and sellers via SMSHub.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>Supported Gateways</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Telebirr (Ethiopian Mobile Money)</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span>CBE Birr & Commercial Bank</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-violet-500" />
              <span>Visa / Mastercard / Awash</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">
            Secured by Chapa Payment Gateway. Instant credit activation upon confirmation.
          </p>
        </div>
      </div>

      {/* Pricing Bundle Cards */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">
            Select an SMS Bundle
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Choose the package that fits your shop volume. Credits never expire.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BILLING_PACKAGES.map((pkg) => {
            const isFeatured = pkg.id === "growth_200";
            const isBusy = purchasingId === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col justify-between p-6 rounded-3xl transition-all duration-200 ${
                  isFeatured
                    ? "bg-slate-900 text-white dark:bg-slate-950 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 md:-translate-y-1.5"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                }`}
              >
                {pkg.badge && (
                  <div className="absolute -top-3.5 right-6">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
                        isFeatured
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{pkg.badge}</span>
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold">{pkg.name}</h3>
                  <p
                    className={`text-xs mt-1 min-h-[32px] ${
                      isFeatured
                        ? "text-slate-300"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {pkg.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-3xl md:text-4xl font-extrabold tracking-tight">
                      {pkg.priceEtb}
                    </span>
                    <span className="text-base font-semibold">ETB</span>
                    {pkg.discount && (
                      <span className="ml-2 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {pkg.discount}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs font-medium text-slate-400">
                    <span>{pkg.credits} SMS Credits</span>
                    <span className="mx-1.5">•</span>
                    <span>{(pkg.priceEtb / pkg.credits).toFixed(2)} ETB / SMS</span>
                  </div>

                  <ul className="mt-6 space-y-2.5 text-xs">
                    <li className="flex items-center gap-2">
                      <Check className={`w-4 h-4 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>Instant balance top-up</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className={`w-4 h-4 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>Telebirr, CBE Birr & Cards</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className={`w-4 h-4 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>No monthly expiration date</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className={`w-4 h-4 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>Real-time delivery receipts</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-200/20 dark:border-slate-800">
                  <button
                    onClick={() => handleBuyPackage(pkg)}
                    disabled={isBusy || loading}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      isFeatured
                        ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-50"
                        : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 disabled:opacity-50"
                    }`}
                  >
                    {isBusy ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Connecting to Chapa...</span>
                      </>
                    ) : (
                      <>
                        <span>Buy with Chapa</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Payment & Top-Up History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit record of your previous Chapa transactions and purchased credits.
            </p>
          </div>
          <button
            onClick={fetchBillingData}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
              <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">No payment transactions yet</p>
              <p className="mt-1">When you top up your account, payment receipts will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Package / Credits</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {(Array.isArray(transactions) ? transactions : []).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px]">
                        {t.txRef}
                      </td>
                      <td className="px-4 py-3.5 font-medium">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{t.creditsAdded} SMS</span>
                        <span className="ml-1 text-slate-400 font-normal">({t.packageId})</span>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        {t.amountEtb} {t.currency}
                      </td>
                      <td className="px-4 py-3.5 uppercase text-[11px] text-slate-500">
                        {t.paymentMethod || "Chapa"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            t.status === "completed"
                              ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                              : t.status === "pending"
                              ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                              : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
