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
import { useTranslation } from "../../../lib/i18n";

export interface BillingClientProps {
  initialBalance?: BillingBalanceDto | null;
  initialTransactions?: PaymentTransactionDto[];
}

export function BillingClient({
  initialBalance = null,
  initialTransactions = [],
}: BillingClientProps = {}) {
  const { t, isAmharic } = useTranslation();
  const [balance, setBalance] = useState<BillingBalanceDto | null>(initialBalance);
  const [transactions, setTransactions] = useState<PaymentTransactionDto[]>(initialTransactions);
  const [loading, setLoading] = useState(!initialBalance && initialTransactions.length === 0);
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {isAmharic ? t.billing.title : "Billing & SMS Credits"}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isAmharic ? t.billing.balanceTopUpSubtitle : "Manage your SMS credit balance and recharge packages."}
        </p>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">{isAmharic ? t.billing.unableToProcess : "Unable to process request"}</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>{isAmharic ? t.billing.remainingCreditsCard : "Remaining Credits"}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${(balance?.smsCredits ?? 0) > 3
                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                  : (balance?.smsCredits ?? 0) > 0
                    ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                    : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                }`}
            >
              {(balance?.smsCredits ?? 0) > 0
                ? (isAmharic ? t.billing.statusActive : "Active")
                : (isAmharic ? t.billing.statusTrialExpired : "Trial Expired")}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {loading ? "..." : balance?.smsCredits ?? 0}
            </span>
            <span className="text-xs font-medium text-slate-400">
              SMS
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {(balance?.smsCredits ?? 0) <= 0
              ? (isAmharic ? t.billing.creditsExhaustedDesc : "Credits exhausted. Recharge to restore SMS alerts.")
              : (balance?.smsCredits ?? 0) <= 3
                ? (isAmharic ? t.billing.creditsLowDesc : "Recharge soon to avoid delivery pauses.")
                : (isAmharic ? t.billing.creditsHealthyDesc : "Healthy balance for storefront operation.")}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>{isAmharic ? t.billing.totalDispatchedCard : "Total SMS Dispatched"}</span>
            <Receipt className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {loading ? "..." : balance?.smsCreditsUsed ?? 0}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {isAmharic ? t.billing.sentLabel : "Sent"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isAmharic ? t.billing.realSmsDeliveredDesc : "Real SMS messages delivered via SMSHub."}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-wider">
            <span>{isAmharic ? t.billing.supportedGatewaysCard : "Supported Gateways"}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {isAmharic ? "ቴሌብር" : "Telebirr"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              {isAmharic ? "ሲቢኢ ብር" : "CBE Birr"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              {isAmharic ? "ካርድ" : "Cards"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {isAmharic ? t.billing.securedByChapaDesc : "Instant credit activation secured by Chapa."}
          </p>
        </div>
      </div>

      {/* Pricing Bundle Cards */}
      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {isAmharic ? t.billing.selectBundleTitle : "Select an SMS Bundle"}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAmharic ? t.billing.selectBundleSubtitle : "Choose the package that fits your shop volume. Credits never expire."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BILLING_PACKAGES.map((pkg) => {
            const isFeatured = pkg.id === "growth_200";
            const isBusy = purchasingId === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col justify-between p-5 rounded-2xl transition-all duration-200 ${isFeatured
                    ? "bg-slate-900 text-white dark:bg-slate-950 border-2 border-emerald-500 shadow-md shadow-emerald-500/10"
                    : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs"
                  }`}
              >
                {pkg.badge && (
                  <div className="absolute -top-2.5 right-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs ${isFeatured
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                        }`}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{isAmharic && pkg.badge === "Popular" ? "ተመራጭ" : isAmharic && pkg.badge === "Best Value" ? "ምርጥ ቅናሽ" : pkg.badge}</span>
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-base font-bold">
                    {isAmharic
                      ? (pkg.id === "starter_50" ? t.billing.starterPack : pkg.id === "growth_200" ? t.billing.growthPack : pkg.id === "pro_500" ? t.billing.proPack : pkg.name)
                      : pkg.name}
                  </h3>
                  <p
                    className={`text-xs mt-1 min-h-[28px] ${isFeatured
                        ? "text-slate-300"
                        : "text-slate-500 dark:text-slate-400"
                      }`}
                  >
                    {isAmharic
                      ? (pkg.id === "starter_50" ? "ለአነስተኛ ሱቆች እና አዲስ ሻጮች ተስማሚ" : pkg.id === "growth_200" ? "ለተሻለ ሽያጭ ላላቸው መካከለኛ ሱቆች ተመራጭ" : pkg.id === "pro_500" ? "ለከፍተኛ የሽያጭ መጠን ላላቸው ሱቆች የሚሆን" : pkg.description)
                      : pkg.description}
                  </p>

                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tracking-tight">
                      {pkg.priceEtb}
                    </span>
                    <span className="text-xs font-semibold">{isAmharic ? "ብር" : "ETB"}</span>
                    {pkg.discount && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {pkg.discount}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 text-xs font-medium text-slate-400">
                    <span>{pkg.credits} {isAmharic ? t.billing.smsCreditsUnit : "SMS Credits"}</span>
                    <span className="mx-1">•</span>
                    <span>{(pkg.priceEtb / pkg.credits).toFixed(2)} {isAmharic ? t.billing.etbPerSms : "ETB / SMS"}</span>
                  </div>

                  <ul className="mt-4 space-y-1.5 text-xs">
                    <li className="flex items-center gap-1.5">
                      <Check className={`w-3.5 h-3.5 flex-shrink-0 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>{isAmharic ? t.billing.featInstantTopUp : "Instant balance top-up"}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className={`w-3.5 h-3.5 flex-shrink-0 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>{isAmharic ? t.billing.featGateways : "Telebirr, CBE Birr & Cards"}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className={`w-3.5 h-3.5 flex-shrink-0 ${isFeatured ? "text-emerald-400" : "text-emerald-500"}`} />
                      <span>{isAmharic ? t.billing.featNoExpiration : "No monthly expiration"}</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200/20 dark:border-slate-800">
                  <button
                    onClick={() => handleBuyPackage(pkg)}
                    disabled={isBusy || loading}
                    className={`w-full py-2.5 px-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all ${isFeatured
                        ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm disabled:opacity-50"
                        : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 disabled:opacity-50"
                      }`}
                  >
                    {isBusy ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{isAmharic ? t.billing.connectingToChapa : "Connecting..."}</span>
                      </>
                    ) : (
                      <>
                        <span>{isAmharic ? t.billing.buyWithChapaBtn : "Buy with Chapa"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
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
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isAmharic ? t.billing.transactionsTitle : "Payment & Top-Up History"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAmharic ? t.billing.auditHistoryDesc : "Audit record of your previous transactions."}
            </p>
          </div>
          <button
            onClick={fetchBillingData}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 font-medium transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{isAmharic ? t.billing.refreshBtn : "Refresh"}</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
              <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {isAmharic ? t.billing.noTransactionsYet : "No payment transactions yet"}
              </p>
              <p className="mt-1">
                {isAmharic ? t.billing.receiptsAppearHere : "When you top up your account, payment receipts will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">{isAmharic ? t.billing.colDate : "Date"}</th>
                    <th className="px-4 py-3">{isAmharic ? t.billing.colRef : "Reference"}</th>
                    <th className="px-4 py-3">{isAmharic ? t.billing.colPackage : "Package / Credits"}</th>
                    <th className="px-4 py-3">{isAmharic ? t.billing.colAmount : "Amount"}</th>
                    <th className="px-4 py-3">{isAmharic ? t.billing.colMethod : "Method"}</th>
                    <th className="px-4 py-3">{isAmharic ? t.billing.colStatus : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {(Array.isArray(transactions) ? transactions : []).map((tx) => {
                    const statusLabel =
                      tx.status === "completed"
                        ? (isAmharic ? t.billing.statusCompleted : "Completed")
                        : tx.status === "pending"
                          ? (isAmharic ? t.billing.statusPending : "Pending")
                          : (isAmharic ? t.billing.statusFailed : (tx.status ? (tx.status.charAt(0).toUpperCase() + tx.status.slice(1)) : "Failed"));

                    const packageName =
                      tx.packageId === "starter_50" || tx.packageId === "starter"
                        ? (isAmharic ? t.billing.starterPack : "Starter Pack")
                        : tx.packageId === "growth_200" || tx.packageId === "growth"
                          ? (isAmharic ? t.billing.growthPack : "Growth Pack")
                          : tx.packageId === "pro_500" || tx.packageId === "pro"
                            ? (isAmharic ? t.billing.proPack : "Pro Pack")
                            : (tx.packageId || "");

                    const methodLabel = tx.paymentMethod
                      ? tx.paymentMethod.toLowerCase() === "chapa"
                        ? (isAmharic ? "ቻፓ" : "Chapa")
                        : tx.paymentMethod.toLowerCase() === "telebirr"
                          ? (isAmharic ? "ቴሌብር" : "Telebirr")
                          : tx.paymentMethod.toLowerCase() === "cbebirr"
                            ? (isAmharic ? "ሲቢኢ ብር" : "CBE Birr")
                            : tx.paymentMethod
                      : (isAmharic ? "ቻፓ" : "Chapa");

                    const formattedDate = new Date(tx.createdAt).toLocaleDateString(
                      isAmharic ? "am-ET" : "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    );
                    const formattedTime = new Date(tx.createdAt).toLocaleTimeString(
                      isAmharic ? "am-ET" : "en-US",
                      { hour: "2-digit", minute: "2-digit" }
                    );

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {formattedDate} {formattedTime}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px]">
                          {tx.txRef}
                        </td>
                        <td className="px-4 py-3.5 font-medium">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">+{tx.creditsAdded} {isAmharic ? t.billing.smsUnit : "SMS"}</span>
                          {packageName ? (
                            <span className="ml-1 text-slate-400 font-normal">({packageName})</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                          {tx.amountEtb} {isAmharic ? "ብር" : (tx.currency || "ETB")}
                        </td>
                        <td className="px-4 py-3.5 uppercase text-[11px] text-slate-500">
                          {methodLabel}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              tx.status === "completed"
                                ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                : tx.status === "pending"
                                  ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
