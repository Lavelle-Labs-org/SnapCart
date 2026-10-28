"use client";

import React, { useState } from "react";
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { maskPhoneNumber as contractsMaskPhone } from "@order-by-sms/contracts";
import { useTranslation } from "../../../lib/i18n";

export interface MessageItem {
  id: string;
  sellerId?: string | null;
  orderId?: string | null;
  recipientPhone: string;
  event: string;
  text: string;
  status: string;
  skipReason?: string | null;
  smshubMessageId?: string | null;
  requestId?: string | null;
  network?: string | null;
  creditsUsed?: number | null;
  errorType?: string | null;
  attempts: number;
  createdAt: string;
  updatedAt?: string;
}

export interface MessagesClientProps {
  initialMessages: MessageItem[];
  isSendingPaused?: boolean;
  isLowBalance?: boolean;
}

/**
 * Masks phone numbers to Ethiopian format (09•• ••• 344) per Section 9.4 (Invariant #6).
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "-";
  if (phone.includes("••")) return phone;
  const clean = phone.replace(/\s+/g, "");
  if (clean.startsWith("+251")) {
    return contractsMaskPhone("0" + clean.slice(4));
  }
  return contractsMaskPhone(clean);
}

/**
 * Formats ISO date string into human-readable timestamp.
 */
export function formatMessageTime(isoString: string, isAmharic: boolean = false): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isAmharic ? "በቅርቡ" : "Recently";
    return date.toLocaleTimeString(isAmharic ? "am-ET" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isAmharic ? "በቅርቡ" : "Recently";
  }
}

/**
 * Returns human-readable skip reason label with Amharic support.
 */
export function formatSkipReason(reason?: string | null, isAmharic: boolean = false): string {
  switch (reason) {
    case "opted_out":
      return isAmharic ? "ደንበኛው መልዕክት አልፈልግም ብሏል" : "Buyer Opted Out";
    case "rate_limited":
      return isAmharic ? "የመልዕክት ገደብ አልፏል" : "Rate Limited";
    case "daily_cap_exceeded":
      return isAmharic ? "የዕለት ገደብ አልፏል" : "Daily Cap Exceeded";
    case "sending_paused":
      return isAmharic ? "መልዕክት መላክ ቆሟል" : "Sending Paused";
    case "not_in_allowlist":
      return isAmharic ? "በተፈቀደ ዝርዝር ውስጥ የለም" : "Not in Allowlist";
    default:
      return isAmharic ? "የታገደ" : (reason ? reason.replace(/_/g, " ") : "Suppressed");
  }
}

/**
 * Returns localized event label.
 */
export function formatEventLabel(event: string, isAmharic: boolean = false): string {
  const key = event.replace(/^(seller_|buyer_)/, "").toLowerCase();
  if (isAmharic) {
    switch (key) {
      case "new_order":
        return "አዲስ ትዕዛዝ";
      case "order_accepted":
        return "ትዕዛዝ ተቀባይነት አግኝቷል";
      case "order_ready":
        return "ትዕዛዝ ዝግጁ ሆኗል";
      case "order_rejected":
        return "ትዕዛዝ ተሰርዟል";
      case "pickup_code":
        return "የመቀበያ ኮድ";
      default:
        return event.replace(/^(seller_|buyer_)/, "").replace(/_/g, " ");
    }
  }
  switch (key) {
    case "new_order":
      return "New Order";
    case "order_accepted":
      return "Order Accepted";
    case "order_ready":
      return "Order Ready";
    case "order_rejected":
      return "Order Rejected";
    case "pickup_code":
      return "Pickup Code";
    default:
      return event.replace(/^(seller_|buyer_)/, "").replace(/_/g, " ");
  }
}

/**
 * Returns localized network name.
 */
export function formatNetworkName(network?: string | null, isAmharic: boolean = false): string {
  if (!network) return isAmharic ? "ቀጥታ" : "Direct";
  const norm = network.toLowerCase();
  if (norm === "ethio_telecom") return isAmharic ? "ኢትዮ ቴሌኮም" : "Ethio Telecom";
  if (norm === "safaricom") return isAmharic ? "ሳፋሪኮም" : "Safaricom";
  return network.replace(/_/g, " ");
}

/**
 * Returns localized credits label.
 */
export function formatCreditsLabel(count: number, isAmharic: boolean = false): string {
  if (isAmharic) {
    return count === 1 ? "1 ክሬዲት" : `${count} ክሬዲቶች`;
  }
  return count === 1 ? "1 credit" : `${count} credits`;
}

/**
 * Renders status badge with real status (never assumes delivered per Invariant #8).
 */
export function getMessageStatusBadge(
  status: string,
  skipReason?: string | null,
  isAmharic: boolean = false
) {
  switch (status) {
    case "sent":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>{isAmharic ? "የተላከ (በኦፕሬተር ተቀባይነት አግኝቷል)" : "Sent (Carrier Accepted)"}</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>{isAmharic ? "ያልተሳካ" : "Failed"}</span>
        </span>
      );
    case "skipped":
      return (
        <span
          title={skipReason ? (isAmharic ? `ምክንያት፡ ${formatSkipReason(skipReason, true)}` : `Reason: ${formatSkipReason(skipReason)}`) : (isAmharic ? "መልዕክት ተዘልሏል" : "Message skipped")}
          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <AlertCircle className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          <span>{isAmharic ? `የተዘለለ (${formatSkipReason(skipReason, true)})` : `Skipped (${formatSkipReason(skipReason)})`}</span>
        </span>
      );
    case "test_passed":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>{isAmharic ? "የሙከራ ሁነታ (አልፏል)" : "Test Mode (Passed)"}</span>
        </span>
      );
    case "unknown":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>{isAmharic ? "ያልታወቀ" : "Unknown"}</span>
        </span>
      );
    case "queued":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          <span>{isAmharic ? "በተራ ላይ ያለ" : "Queued"}</span>
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          {status}
        </span>
      );
  }
}

/**
 * Resends a failed or unknown message via POST /api/messages/:id/resend (FE-012, BE-016).
 */
export async function resendMessageApi(
  messageId: string,
  fetchFn: typeof fetch = fetch
): Promise<{ success: boolean; data: { resent: boolean; message: any } }> {
  const response = await fetchFn(`/api/messages/${encodeURIComponent(messageId)}/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const body = await response.json();
  if (!response.ok || (body && body.success === false)) {
    const errorMsg =
      body?.error?.message ||
      body?.message ||
      `Resend failed with HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return body;
}

/**
 * Fetches latest messages from GET /api/messages.
 */
export async function fetchMessagesApi(
  fetchFn: typeof fetch = fetch
): Promise<MessageItem[]> {
  const response = await fetchFn("/api/messages", {
    headers: { Accept: "application/json" },
  });

  const body = await response.json();
  if (!response.ok || (body && body.success === false)) {
    throw new Error(body?.error?.message || "Failed to load messages");
  }

  return body.data || body;
}

export default function MessagesClient({
  initialMessages,
  isSendingPaused = false,
  isLowBalance = false,
}: MessagesClientProps) {
  const { t, isAmharic } = useTranslation();
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActionNotice(null);
    try {
      const refreshed = await fetchMessagesApi();
      setMessages(refreshed);
    } catch (err: any) {
      setActionNotice({
        type: "error",
        message: err?.message || "Failed to refresh messages",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredMessages = messages.filter((msg) => {
    if (statusFilter === "all") return true;
    return msg.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isAmharic ? t.messages.title : "SMS Message Audit Log"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAmharic ? t.messages.subtitle : "Real delivery statuses, credit deduction, and message IDs from SMSHub."}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? (isAmharic ? t.messages.refreshing : "Refreshing...") : (isAmharic ? t.messages.refreshBtn : "Refresh")}</span>
          </button>
        </div>
      </div>

      {/* Banners (Acceptance Criterion 4) */}
      {isSendingPaused && (
        <div
          role="alert"
          className="flex items-center space-x-3 p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-900 dark:text-amber-200"
        >
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">{isAmharic ? "የኤስኤምኤስ መልዕክት መላክ ቆሟል።" : "SMS sending is currently paused."}</span>{" "}
            {isAmharic ? "የደንበኞች ማረጋገጫ ኮዶች እና ማሳወቂያዎች በድንገተኛ ማቆሚያ ምክንያት ለጊዜው ተቋርጠዋል።" : "Outgoing transactional messages and verification codes are temporarily suspended by emergency switch."}
          </div>
        </div>
      )}

      {isLowBalance && (
        <div
          role="alert"
          className="flex items-center space-x-3 p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-900 dark:text-rose-200"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">{isAmharic ? "የኤስኤምኤስ ክሬዲት መጠን አነስተኛ ነው።" : "SMS credit balance is low."}</span>{" "}
            {isAmharic ? "የደንበኞች ትዕዛዝ ማሳወቂያ እንዳይቋረጥ እባክዎ ክሬዲት ይሙሉ::" : "Please replenish credits to prevent delivery interruptions for incoming customer orders."}
          </div>
        </div>
      )}

      {/* Action Notice Toast */}
      {actionNotice && (
        <div
          role="status"
          className={`p-3.5 rounded-lg text-sm font-medium border flex items-center justify-between ${actionNotice.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900"
              : "bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900"
            }`}
        >
          <span>{actionNotice.message}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold hover:underline ml-4"
          >
            {isAmharic ? "ዝጋ" : "Dismiss"}
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-sm">
        {[
          { key: "all", label: isAmharic ? t.messages.filterAll : "All Messages" },
          { key: "sent", label: isAmharic ? t.messages.filterSent : "Sent" },
          { key: "failed", label: isAmharic ? t.messages.filterFailed : "Failed" },
          { key: "skipped", label: isAmharic ? t.messages.filterSkipped : "Skipped" },
          { key: "unknown", label: isAmharic ? t.messages.filterUnknown : "Unknown" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === tab.key
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages Table & Mobile Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        {/* Mobile Stacked Card View (< md) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredMessages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
              <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              {isAmharic ? t.messages.emptyText : "No SMS messages match the selected filter."}
            </div>
          ) : (
            filteredMessages.map((msg) => {
              return (
                <div key={`mobile-${msg.id}`} className="p-4 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {maskPhoneNumber(msg.recipientPhone)}
                    </div>
                    <div>
                      {getMessageStatusBadge(msg.status, msg.skipReason, isAmharic)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {formatEventLabel(msg.event, isAmharic)}
                    </span>
                    <span>{formatMessageTime(msg.createdAt, isAmharic)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                    <div className="flex items-center gap-2">
                      <span>{formatNetworkName(msg.network, isAmharic)}</span>
                      <span>•</span>
                      <span>{formatCreditsLabel(msg.creditsUsed ?? 0, isAmharic)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">{isAmharic ? t.messages.colTime : "Time"}</th>
                <th className="px-4 py-3">{isAmharic ? t.messages.colRecipient : "Recipient"}</th>
                <th className="px-4 py-3">{isAmharic ? t.messages.colEvent : "Event"}</th>
                <th className="px-4 py-3">{isAmharic ? t.messages.colStatus : "Status"}</th>
                <th className="px-4 py-3">{isAmharic ? t.messages.colNetwork : "Network"}</th>
                <th className="px-4 py-3">{isAmharic ? t.messages.colCredits : "Credits"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    {isAmharic ? t.messages.emptyText : "No SMS messages match the selected filter."}
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => {
                  return (
                    <tr key={msg.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      {/* Time */}
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatMessageTime(msg.createdAt, isAmharic)}
                      </td>

                      {/* Recipient */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {maskPhoneNumber(msg.recipientPhone)}
                      </td>

                      {/* Event */}
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <span>{formatEventLabel(msg.event, isAmharic)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getMessageStatusBadge(msg.status, msg.skipReason, isAmharic)}
                      </td>

                      {/* Network */}
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {formatNetworkName(msg.network, isAmharic)}
                      </td>

                      {/* Credits */}
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {msg.creditsUsed ?? 0}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
