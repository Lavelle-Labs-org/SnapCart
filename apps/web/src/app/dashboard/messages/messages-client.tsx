"use client";

import React, { useState } from "react";
import {
  Mail,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  Send,
  ShieldAlert,
} from "lucide-react";
import { maskPhoneNumber as contractsMaskPhone } from "@order-by-sms/contracts";

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
export function formatMessageTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Recently";
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Recently";
  }
}

/**
 * Returns human-readable skip reason label.
 */
function formatSkipReason(reason?: string | null): string {
  switch (reason) {
    case "opted_out":
      return "Buyer Opted Out";
    case "rate_limited":
      return "Rate Limited";
    case "daily_cap_exceeded":
      return "Daily Cap Exceeded";
    case "sending_paused":
      return "Sending Paused";
    case "not_in_allowlist":
      return "Not in Allowlist";
    default:
      return reason ? reason.replace(/_/g, " ") : "Suppressed";
  }
}

/**
 * Renders status badge with real status (never assumes delivered per Invariant #8).
 */
export function getMessageStatusBadge(status: string, skipReason?: string | null) {
  switch (status) {
    case "sent":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>Sent (Carrier Accepted)</span>
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>Failed</span>
        </span>
      );
    case "skipped":
      return (
        <span
          title={skipReason ? `Reason: ${formatSkipReason(skipReason)}` : "Message skipped"}
          className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <AlertCircle className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          <span>Skipped ({formatSkipReason(skipReason)})</span>
        </span>
      );
    case "test_passed":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
          <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>Test Mode (Passed)</span>
        </span>
      );
    case "unknown":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <HelpCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>Unknown</span>
        </span>
      );
    case "queued":
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Clock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
          <span>Queued</span>
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
  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const handleCopy = async (id: string, textToCopy: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard write errors
    }
  };

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

  const handleResend = async (msg: MessageItem) => {
    setResendingId(msg.id);
    setActionNotice(null);
    try {
      const res = await resendMessageApi(msg.id);
      const updated = res.data?.message;

      if (updated) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, ...updated } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? { ...m, status: "sent", attempts: m.attempts + 1 }
              : m
          )
        );
      }

      setActionNotice({
        type: "success",
        message: `Message for ${maskPhoneNumber(msg.recipientPhone)} resent successfully.`,
      });
    } catch (err: any) {
      setActionNotice({
        type: "error",
        message: `Resend failed: ${err?.message || "Unknown error"}`,
      });
    } finally {
      setResendingId(null);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">SMS Message Audit Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real delivery statuses, credit deduction, and message IDs from SMSHub.
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
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Banners (Acceptance Criterion 4) */}
      {isSendingPaused && (
        <div
          role="alert"
          className="flex items-center space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900"
        >
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">SMS sending is currently paused.</span> Outgoing
            transactional messages and verification codes are temporarily suspended by emergency switch.
          </div>
        </div>
      )}

      {isLowBalance && (
        <div
          role="alert"
          className="flex items-center space-x-3 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">SMS credit balance is low.</span> Please replenish credits
            to prevent delivery interruptions for incoming customer orders.
          </div>
        </div>
      )}

      {/* Action Notice Toast */}
      {actionNotice && (
        <div
          role="status"
          className={`p-3.5 rounded-lg text-sm font-medium border flex items-center justify-between ${
            actionNotice.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{actionNotice.message}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-xs font-bold hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto text-sm">
        {[
          { key: "all", label: "All Messages" },
          { key: "sent", label: "Sent" },
          { key: "failed", label: "Failed" },
          { key: "skipped", label: "Skipped" },
          { key: "unknown", label: "Unknown" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              statusFilter === tab.key
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
              No SMS messages match the selected filter.
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const displayId = msg.smshubMessageId || msg.id;
              const canResend =
                msg.status === "failed" || msg.status === "unknown";
              const isThisResending = resendingId === msg.id;
              const eventLabel = msg.event.replace(/^(seller_|buyer_)/, "").replace(/_/g, " ");

              return (
                <div key={`mobile-${msg.id}`} className="p-4 space-y-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {maskPhoneNumber(msg.recipientPhone)}
                    </div>
                    <div>
                      {getMessageStatusBadge(msg.status, msg.skipReason)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                      {eventLabel}
                    </span>
                    <span>{formatMessageTime(msg.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="capitalize">{msg.network ? msg.network.replace("_", " ") : "Direct"}</span>
                      <span>•</span>
                      <span>{msg.creditsUsed ?? 0} {msg.creditsUsed === 1 ? "credit" : "credits"}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[100px]">{displayId}</span>
                      <button
                        type="button"
                        title="Copy ID"
                        aria-label={`Copy ID ${displayId}`}
                        onClick={() => handleCopy(msg.id, displayId)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  {canResend && (
                    <div className="pt-2">
                      <button
                        type="button"
                        aria-label={`Resend message ${msg.id}`}
                        disabled={isThisResending}
                        onClick={() => handleResend(msg)}
                        className="w-full inline-flex items-center justify-center space-x-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 py-2.5 px-3 rounded-lg transition disabled:opacity-50 min-h-[44px]"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{isThisResending ? "Resending..." : "Resend Message"}</span>
                      </button>
                    </div>
                  )}
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
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Network</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">SMSHub ID</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    <Mail className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    No SMS messages match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredMessages.map((msg) => {
                  const displayId = msg.smshubMessageId || msg.id;
                  const canResend =
                    msg.status === "failed" || msg.status === "unknown";
                  const isThisResending = resendingId === msg.id;

                  return (
                    <tr key={msg.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      {/* Time */}
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatMessageTime(msg.createdAt)}
                      </td>

                      {/* Recipient */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {maskPhoneNumber(msg.recipientPhone)}
                      </td>

                      {/* Event */}
                      <td className="px-4 py-3.5 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        <span className="capitalize">
                          {msg.event.replace(/^(seller_|buyer_)/, "").replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getMessageStatusBadge(msg.status, msg.skipReason)}
                      </td>

                      {/* Network */}
                      <td className="px-4 py-3.5 text-xs capitalize text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {msg.network ? msg.network.replace("_", " ") : "-"}
                      </td>

                      {/* Credits */}
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {msg.creditsUsed ?? 0}
                      </td>

                      {/* SMSHub ID with Copy Button (Acceptance Criterion 2) */}
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="truncate max-w-[130px]">{displayId}</span>
                          <button
                            type="button"
                            title="Copy ID"
                            aria-label={`Copy ID ${displayId}`}
                            onClick={() => handleCopy(msg.id, displayId)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1 rounded"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Row Action: Resend Button (Acceptance Criterion 3) */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {canResend && (
                          <button
                            type="button"
                            aria-label={`Resend message ${msg.id}`}
                            disabled={isThisResending}
                            onClick={() => handleResend(msg)}
                            className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-md transition disabled:opacity-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>{isThisResending ? "Resending..." : "Resend"}</span>
                          </button>
                        )}
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
