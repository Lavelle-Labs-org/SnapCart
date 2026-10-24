"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Phone,
  Check,
  X,
  BellRing,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ShieldCheck,
} from "lucide-react";

export interface OrderItemData {
  id: string;
  name: string;
  quantity: number;
  priceBirr: number;
}

export interface ActionOrderData {
  id: string;
  number: number;
  buyerName: string;
  buyerPhone: string;
  smsConsent: boolean;
  state: "new" | "accepted" | "ready" | "completed" | "rejected";
  totalBirr: number;
  items: OrderItemData[];
  shopName?: string;
}

interface SellerActionClientProps {
  token: string;
  order: ActionOrderData;
}

export function SellerActionClient({ token, order }: SellerActionClientProps) {
  const [currentState, setCurrentState] = useState(order.state);
  const [pickupCode, setPickupCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Helper for SMS status feedback
  const formatSmsNotice = (status?: string) => {
    switch (status) {
      case "sent":
        return "SMS alert dispatched to customer.";
      case "queued":
        return "SMS alert queued for delivery.";
      case "skipped":
        return "SMS skipped (customer opted out or no consent).";
      case "failed":
        return "SMS alert could not be delivered.";
      default:
        return "";
    }
  };

  // Perform state transition action
  const handleAction = async (action: "accept" | "reject" | "ready" | "complete") => {
    if (isSubmitting) return;

    if (action === "complete") {
      const cleanCode = pickupCode.trim();
      if (!/^\d{4}$/.test(cleanCode)) {
        setErrorMessage("Please enter the complete 4-digit pickup code.");
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const url = `/api/a/${token}/${action}`;
      const options: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "complete" ? { body: JSON.stringify({ code: pickupCode.trim() }) } : {}),
      };

      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "Failed to process action. Please try again.";

        if (data?.error?.remainingAttempts !== undefined) {
          setRemainingAttempts(data.error.remainingAttempts);
        }

        setErrorMessage(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // Success
      const newState = data.currentState || data.data?.currentState || (
        action === "accept"
          ? "accepted"
          : action === "reject"
          ? "rejected"
          : action === "ready"
          ? "ready"
          : "completed"
      );

      setCurrentState(newState);
      setShowRejectConfirm(false);
      setRemainingAttempts(null);

      // Feedback notice
      const smsStatus = data.smsStatus ?? data.data?.smsStatus;
      const smsMsg = formatSmsNotice(smsStatus);

      if (action === "accept") {
        setSuccessNotice(`Order #${order.number} accepted! ${smsMsg}`);
      } else if (action === "reject") {
        setSuccessNotice(`Order #${order.number} rejected. ${smsMsg}`);
      } else if (action === "ready") {
        setSuccessNotice(`Order #${order.number} marked ready! Pickup code texted to customer.`);
      } else if (action === "complete") {
        setSuccessNotice(`Order #${order.number} completed successfully!`);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBadge = () => {
    switch (currentState) {
      case "new":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 uppercase">
            New Order
          </span>
        );
      case "accepted":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 uppercase">
            Preparing
          </span>
        );
      case "ready":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 uppercase">
            Ready for Pickup
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 uppercase">
            Completed
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 uppercase">
            Rejected
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">
            {order.shopName || "Seller Action"}
          </span>
          <h1 className="text-lg font-bold text-slate-900">Order #{order.number}</h1>
        </div>
        <div>{renderBadge()}</div>
      </header>

      {/* Main Order Surface */}
      <main className="p-4 space-y-4 flex-1">
        {/* Alerts & Feedback */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="mt-1 text-rose-600">
                  {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} remaining before lock.
                </p>
              )}
            </div>
          </div>
        )}

        {successNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{successNotice}</span>
          </div>
        )}

        {/* Customer Contact Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-slate-500 font-medium">Customer</p>
            <p className="font-bold text-slate-900 text-base">{order.buyerName}</p>
            <p className="text-xs text-slate-600 font-mono mt-0.5">{order.buyerPhone}</p>
          </div>
          <a
            href={`tel:${order.buyerPhone}`}
            className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition border border-emerald-200 min-h-[44px]"
            aria-label={`Call customer at ${order.buyerPhone}`}
          >
            <Phone className="w-4 h-4" />
            <span>Call</span>
          </a>
        </div>

        {/* Item Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Ordered Items ({order.items.length})
          </h2>
          <div className="divide-y divide-slate-100 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-2.5">
                <div>
                  <span className="font-bold text-slate-900 mr-2">{item.quantity}x</span>
                  <span className="text-slate-800">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-700 tabular-nums">
                  {item.quantity * item.priceBirr} ETB
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 flex justify-between items-center text-slate-900">
            <span className="font-semibold text-sm">Total Payable (Cash)</span>
            <span className="text-emerald-600 font-bold text-xl tabular-nums">{order.totalBirr} ETB</span>
          </div>
        </div>

        {/* State-specific explanatory notes */}
        {currentState === "new" && !showRejectConfirm && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-start space-x-2">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>
              Tap <strong>Accept</strong> to confirm this order. The customer will receive an SMS confirmation.
            </span>
          </div>
        )}

        {currentState === "accepted" && (
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex items-start space-x-2">
            <BellRing className="w-4 h-4 text-slate-600 flex-shrink-0 mt-0.5" />
            <span>
              When preparation is finished, tap <strong>Mark Ready</strong> to text the customer their 4-digit pickup code.
            </span>
          </div>
        )}

        {currentState === "ready" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              Ask customer for their 4-digit code from SMS to complete handover.
            </span>
          </div>
        )}

        {/* Terminal state: Completed */}
        {currentState === "completed" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-emerald-900 text-lg">Order Handover Complete</h3>
            <p className="text-xs text-emerald-700 max-w-xs mx-auto">
              Handover verified with valid pickup code. This order is closed and payment is collected.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition"
              >
                Go to Orders Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Terminal state: Rejected */}
        {currentState === "rejected" && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-rose-900 text-lg">Order Rejected</h3>
            <p className="text-xs text-rose-700 max-w-xs mx-auto">
              The order was cancelled and an SMS notification was sent to the customer.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition"
              >
                Go to Orders Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Reject Confirmation Card */}
        {showRejectConfirm && (
          <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-rose-900 text-sm">Reject Order #{order.number}?</h3>
            <p className="text-xs text-rose-700">
              The customer will receive an SMS notifying them that their order could not be fulfilled.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRejectConfirm(false)}
                disabled={isSubmitting}
                className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 px-3 rounded-lg text-xs transition min-h-[44px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => handleAction("reject")}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-3 rounded-lg text-xs transition flex items-center justify-center space-x-1.5 min-h-[44px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Yes, Reject</span>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Action Footer Buttons */}
      {currentState !== "completed" && currentState !== "rejected" && !showRejectConfirm && (
        <footer className="bg-white border-t p-4 sticky bottom-0 space-y-3 z-10">
          {currentState === "new" && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShowRejectConfirm(true)}
                disabled={isSubmitting}
                className="col-span-1 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold py-3.5 rounded-xl transition flex items-center justify-center space-x-1 disabled:opacity-50 min-h-[44px]"
              >
                <X className="w-4 h-4" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => handleAction("accept")}
                disabled={isSubmitting}
                className="col-span-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Accepting...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Accept Order</span>
                  </>
                )}
              </button>
            </div>
          )}

          {currentState === "accepted" && (
            <button
              type="button"
              onClick={() => handleAction("ready")}
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Marking Ready...</span>
                </>
              ) : (
                <>
                  <BellRing className="w-5 h-5" />
                  <span>Mark Ready & Send Code</span>
                </>
              )}
            </button>
          )}

          {currentState === "ready" && (
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="Enter 4-Digit Pickup Code"
                  value={pickupCode}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setPickupCode(cleaned);
                    setErrorMessage(null);
                  }}
                  disabled={isSubmitting}
                  className="w-full text-center text-2xl font-mono tracking-widest py-3 border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none bg-white min-h-[44px]"
                  aria-label="4-digit pickup code"
                />
                <p className="text-[11px] text-slate-500 text-center mt-1">
                  Customer must provide 4 digits from their SMS
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAction("complete")}
                disabled={pickupCode.trim().length !== 4 || isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 min-h-[44px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-5 h-5" />
                    <span>Complete Handover</span>
                  </>
                )}
              </button>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
