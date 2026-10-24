"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  XCircle,
  PackageCheck,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  KeyRound,
} from "lucide-react";

export interface OrderActionsProps {
  orderId: string;
  initialState: string;
  onStateChange?: (newState: string) => void;
}

export function validatePickupCode(code: string): { isValid: boolean; error?: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { isValid: false, error: "Please enter the 4-digit pickup code" };
  }
  if (!/^\d{4}$/.test(trimmed)) {
    return { isValid: false, error: "Pickup code must be exactly 4 digits (0-9)" };
  }
  return { isValid: true };
}

export async function submitOrderAction(
  orderId: string,
  action: "accept" | "reject" | "ready" | "complete" | "reissue",
  pickupCode?: string,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean; state?: string; message?: string }> {
  let endpoint = `/api/orders/${encodeURIComponent(orderId)}/${action}`;
  let body: any = undefined;

  if (action === "complete") {
    const validation = validatePickupCode(pickupCode || "");
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
    body = JSON.stringify({ code: pickupCode!.trim(), pickupCode: pickupCode!.trim() });
  } else if (action === "reissue") {
    endpoint = `/api/orders/${encodeURIComponent(orderId)}/pickup-code/reissue`;
  }

  const res = await fetchFn(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    let errorMsg = `Action '${action}' failed (${res.status})`;
    try {
      const errData = await res.json();
      errorMsg = errData.message || errData.error || errorMsg;
    } catch {
      // Ignore json parse error
    }
    throw new Error(errorMsg);
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    // Ignore json parse error
  }

  const stateMap: Record<string, string> = {
    accept: "accepted",
    reject: "rejected",
    ready: "ready",
    complete: "completed",
  };

  return {
    success: true,
    state: data?.state || stateMap[action] || undefined,
    message: data?.message || (action === "reissue" ? "New pickup code texted to buyer" : undefined),
  };
}

export default function OrderActions({
  orderId,
  initialState,
  onStateChange,
}: OrderActionsProps) {
  const router = useRouter();
  const [currentState, setCurrentState] = useState(initialState);
  const [pickupCode, setPickupCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);

  const handleAction = async (
    action: "accept" | "reject" | "ready" | "complete" | "reissue"
  ) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const result = await submitOrderAction(orderId, action, pickupCode);
      if (result.state) {
        setCurrentState(result.state);
        onStateChange?.(result.state);
      }
      if (result.message) {
        setSuccessMsg(result.message);
      }
      if (action === "complete") {
        setPickupCode("");
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.message || `Failed to execute ${action}`);
    } finally {
      setIsLoading(false);
      setConfirmReject(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Order Actions
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          State: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentState}</span>
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* State: NEW (Accept or Reject) */}
      {currentState === "new" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            This order was recently placed. Review the items and accept to notify the buyer or decline if unavailable.
          </p>

          {confirmReject ? (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                Are you sure you want to reject this order?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleAction("reject")}
                  className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 min-h-[44px] inline-flex items-center justify-center"
                >
                  {isLoading ? "Rejecting..." : "Yes, Reject Order"}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setConfirmReject(false)}
                  className="px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium min-h-[44px] inline-flex items-center justify-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleAction("accept")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm min-h-[44px]"
              >
                <Check className="w-4 h-4" />
                <span>{isLoading ? "Accepting..." : "Accept Order"}</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => setConfirmReject(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-sm font-semibold transition disabled:opacity-50 min-h-[44px]"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Order</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* State: ACCEPTED (Mark Ready) */}
      {currentState === "accepted" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Order is being prepared. When packed, mark it ready to generate and text the 4-digit pickup code to the buyer.
          </p>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleAction("ready")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm min-h-[44px]"
          >
            <PackageCheck className="w-4 h-4" />
            <span>{isLoading ? "Updating..." : "Mark Ready for Pickup"}</span>
          </button>
        </div>
      )}

      {/* State: READY (Enter 4-Digit Pickup Code + Complete / Reissue) */}
      {currentState === "ready" && (
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
            <span className="font-semibold block mb-1">Handover Verification</span>
            <span>Ask buyer for their 4-digit SMS pickup code to complete the order.</span>
          </div>

          <div className="space-y-2">
            <label htmlFor="pickup-code-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              4-Digit Pickup Code:
            </label>
            <div className="flex gap-2">
              <input
                id="pickup-code-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, ""))}
                placeholder="1234"
                className="w-32 px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-center font-mono text-lg tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none min-h-[44px]"
              />
              <button
                type="button"
                disabled={isLoading || pickupCode.length !== 4}
                onClick={() => handleAction("complete")}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-sm min-h-[44px]"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isLoading ? "Verifying..." : "Complete Order"}</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Buyer lost their code?</span>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleAction("reissue")}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition disabled:opacity-50 min-h-[44px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Reissue Pickup Code</span>
            </button>
          </div>
        </div>
      )}

      {/* State: COMPLETED (Terminal State) */}
      {currentState === "completed" && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="font-semibold">Handover Completed & Verified</span>
        </div>
      )}

      {/* State: REJECTED (Terminal State) */}
      {currentState === "rejected" && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span className="font-semibold">Order Rejected</span>
        </div>
      )}
    </div>
  );
}
