"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  PackageCheck,
  AlertCircle,
  MessageSquare,
  Phone,
  User,
  ShieldCheck,
  ChevronRight,
  History,
} from "lucide-react";
import { formatBirr, maskPhoneNumber } from "@order-by-sms/contracts";
import OrderActions from "./order-actions";
import { useTranslation } from "../../../../lib/i18n";

export interface SerializedOrderItem {
  id: string;
  name_at_order: string;
  unit_price_santim: number;
  quantity: number;
}

export interface SerializedOrderEvent {
  id: string;
  from_state: string | null;
  to_state: string;
  actor: string;
  created_at: string | Date;
}

export interface SerializedOrderMessage {
  id: string;
  event: string;
  recipient_phone: string;
  phone?: string;
  status: string;
  created_at: string | Date;
}

export interface SerializedOrderDetail {
  id: string;
  seller_id: string;
  number: number;
  buyer_name: string | null;
  buyer_phone: string;
  sms_consent: boolean;
  consent_wording?: string | null;
  consent_at?: string | Date | null;
  state: string;
  total_santim: number;
  created_at: string | Date;
  order_items: SerializedOrderItem[];
  order_events: SerializedOrderEvent[];
  messages: SerializedOrderMessage[];
}

export interface OrderDetailClientProps {
  order: SerializedOrderDetail;
  initialLocale?: "en" | "am";
  children?: React.ReactNode;
}

function formatDateTime(dateInput: Date | string, isAmharic = false): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return isAmharic ? "በቅርቡ" : "Recently";
  return date.toLocaleString(isAmharic ? "am-ET" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusBadge(state: string, isAmharic = false) {
  switch (state) {
    case "new":
      return (
        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {isAmharic ? "አዲስ" : "New"}
        </span>
      );
    case "accepted":
      return (
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          {isAmharic ? "ተቀባይነት አግኝቷል" : "Accepted"}
        </span>
      );
    case "ready":
      return (
        <span className="px-3 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5" />
          {isAmharic ? "ለመረከብ ዝግጁ" : "Ready for Pickup"}
        </span>
      );
    case "completed":
      return (
        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          {isAmharic ? "ተጠናቋል" : "Completed"}
        </span>
      );
    case "rejected":
      return (
        <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {isAmharic ? "ውድቅ ተደርጓል" : "Rejected"}
        </span>
      );
    default:
      return (
        <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-semibold uppercase tracking-wider">
          {state}
        </span>
      );
  }
}

export function OrderDetailClient({ order, children }: OrderDetailClientProps) {
  const { t, isAmharic } = useTranslation();
  const [currentState, setCurrentState] = useState(order.state);

  const totalFormatted = formatBirr(order.total_santim ?? 0, {
    suffix: isAmharic ? " ብር" : " ETB",
  });
  const maskedPhone = maskPhoneNumber(order.buyer_phone || "");

  const steps = [
    { key: "new", label: isAmharic ? t.orders.stepPlaced : "Placed" },
    { key: "accepted", label: isAmharic ? t.orders.stepAccepted : "Accepted" },
    { key: "ready", label: isAmharic ? t.orders.stepReady : "Ready" },
    { key: "completed", label: isAmharic ? t.orders.stepCompleted : "Completed" },
  ];

  const stateOrder = ["new", "accepted", "ready", "completed"];
  const currentIdx = stateOrder.indexOf(currentState);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
        <Link
          href="/dashboard"
          className="hover:text-slate-900 dark:hover:text-slate-200 transition flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isAmharic ? "ትዕዛዞች" : "Orders"}</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
        <span className="font-semibold text-slate-800 dark:text-slate-200">
          {isAmharic ? t.orders.detailHeading(order.number) : `Order #${order.number}`}
        </span>
      </nav>

      {/* Main Order Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isAmharic ? t.orders.detailHeading(order.number) : `Order #${order.number}`}
            </h1>
            {getStatusBadge(currentState, isAmharic)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
            {`ID: ${order.id}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              {isAmharic ? t.orders.totalAmount : "Total Amount"}
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {totalFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Lifecycle Progress Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4">
          {isAmharic ? t.orders.lifecycleTitle : "Order Lifecycle Status"}
        </h2>

        {currentState === "rejected" ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-center gap-3 text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="text-sm">
              <span className="font-semibold">
                {isAmharic ? t.orders.orderRejectedTitle : "Order Rejected"}
              </span>{" "}
              — {isAmharic ? t.orders.orderRejectedDesc : "This order was declined and will not proceed to fulfillment."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {steps.map((step, idx) => {
              const isPassed = currentIdx >= idx;
              const isCurrent = currentIdx === idx;
              return (
                <div key={step.key} className="flex flex-col items-center text-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition ${
                      isPassed
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {isPassed ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isCurrent
                        ? "text-slate-900 dark:text-slate-100 font-bold"
                        : isPassed
                        ? "text-slate-700 dark:text-slate-300"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Main Order Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Items, State Timeline & SMS Logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table (Acceptance Criterion 1) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {isAmharic
                  ? t.orders.orderItemsTitle(order.order_items?.length || 0)
                  : `Order Items (${order.order_items?.length || 0})`}
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {order.order_items?.map((item) => {
                const unitPrice = item.unit_price_santim ?? 0;
                const unitFormatted = formatBirr(unitPrice, {
                  suffix: isAmharic ? " ብር" : " ETB",
                });
                const lineFormatted = formatBirr(unitPrice * (item.quantity ?? 1), {
                  suffix: isAmharic ? " ብር" : " ETB",
                });
                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                        {item.name_at_order}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {`${item.quantity} × ${unitFormatted}`}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {lineFormatted}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between font-bold text-base text-slate-900 dark:text-slate-100">
              <span>{isAmharic ? t.orders.grandTotal : "Grand Total"}</span>
              <span>{totalFormatted}</span>
            </div>
          </div>

          {/* State Transition History Timeline (Acceptance Criterion 2, FR-17) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2>{isAmharic ? t.orders.stateHistoryTitle : "State Transition Audit History"}</h2>
            </div>

            {order.order_events && order.order_events.length > 0 ? (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {order.order_events.map((evt) => (
                  <div key={evt.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500 shadow-sm" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 uppercase">
                          {evt.from_state ? `${evt.from_state} → ${evt.to_state}` : `Created as ${evt.to_state}`}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                          {evt.actor}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(evt.created_at, isAmharic)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                {isAmharic ? t.orders.noTransitionsRecorded : "No transition events recorded yet."}
              </p>
            )}
          </div>

          {/* SMS Audit Trail (Acceptance Criterion 3, FR-17, Invariant #8) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-semibold text-sm">
              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2>{isAmharic ? t.orders.smsAuditTitle : "SMS Notifications Audit Log"}</h2>
            </div>

            {order.messages && order.messages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">{isAmharic ? t.orders.colEvent : "Event"}</th>
                      <th className="py-2 px-3">{isAmharic ? t.orders.colRecipient : "Recipient"}</th>
                      <th className="py-2 px-3">{isAmharic ? t.orders.colStatus : "Status"}</th>
                      <th className="py-2 px-3">{isAmharic ? t.orders.colTimestamp : "Timestamp"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {order.messages.map((msg) => {
                      const msgStatusLabel = isAmharic
                        ? (msg.status === "sent"
                            ? "የተላከ"
                            : msg.status === "test_passed"
                              ? "የሙከራ ሁነታ (አልፏል)"
                              : msg.status === "failed"
                                ? "ያልተሳካ"
                                : msg.status === "skipped"
                                  ? "የተዘለለ"
                                  : msg.status === "queued"
                                    ? "በተራ ላይ ያለ"
                                    : msg.status)
                        : msg.status;

                      return (
                        <tr key={msg.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                            {msg.event}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            {maskPhoneNumber(msg.recipient_phone || msg.phone || "")}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                msg.status === "sent" || msg.status === "test_passed"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : msg.status === "failed"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                  : msg.status === "skipped"
                                  ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              }`}
                            >
                              {msgStatusLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                            {formatDateTime(msg.created_at, isAmharic)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                {isAmharic ? t.orders.noSmsAuditRecorded : "No SMS audit log records recorded for this order yet."}
              </p>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Order Actions & Customer Info */}
        <div className="space-y-6">
          {/* Action Buttons Component (Acceptance Criterion 4, FR-18, FR-20) */}
          {children && React.isValidElement(children)
            ? React.cloneElement(children as React.ReactElement<any>, {
                onStateChange: (newState: string) => setCurrentState(newState),
              })
            : (
              <OrderActions
                orderId={order.id}
                initialState={currentState}
                onStateChange={(newState) => setCurrentState(newState)}
              />
            )}

          {/* Customer Details */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {isAmharic ? t.orders.customerInfoTitle : "Customer Information"}
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {order.buyer_name || (isAmharic ? t.orders.guestCustomer : "Guest Customer")}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                <a
                  href={`tel:${order.buyer_phone}`}
                  className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {maskedPhone}
                </a>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>
                  {order.sms_consent
                    ? (isAmharic ? t.orders.smsConsentGranted : "SMS Consent Granted")
                    : (isAmharic ? t.orders.noSmsConsent : "No SMS Consent")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrderDetailClient;
