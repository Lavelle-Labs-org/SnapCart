import React from "react";
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
import { prisma } from "../../../../lib/prisma";
import { toBirr, formatBirr, maskPhoneNumber, OrderState } from "@order-by-sms/contracts";
import OrderActions from "./order-actions";

import { notFound, redirect } from "next/navigation";
import { extractSellerIdFromToken } from "../../dashboard-helpers";

export interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getStatusBadge(state: string) {
  switch (state) {
    case "new":
      return (
        <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          New
        </span>
      );
    case "accepted":
      return (
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          Accepted
        </span>
      );
    case "ready":
      return (
        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <PackageCheck className="w-3.5 h-3.5" />
          Ready for Pickup
        </span>
      );
    case "completed":
      return (
        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          Completed
        </span>
      );
    case "rejected":
      return (
        <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Rejected
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

/**
 * Seller Order Detail Page (FE-010, FR-17, FR-18, FR-20).
 * Displays full itemized breakdown, unit prices, Birr totals, buyer contact info,
 * state transition history timeline, SMS audit log table, and live order action buttons.
 */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;

  let sellerId: string | null = null;
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("seller_session")?.value;
    if (token) {
      sellerId = await extractSellerIdFromToken(token);
    }
  } catch {
    // Outside request context (e.g. testing or static build)
  }

  if (!sellerId) {
    redirect("/login");
    return null;
  }

  let dbOrder: any = null;

  try {
    if (prisma?.order?.findUnique) {
      dbOrder = await prisma.order.findUnique({
        where: { id },
        include: {
          seller: true,
          order_items: true,
          order_events: {
            orderBy: { created_at: "asc" },
          },
          messages: {
            orderBy: { created_at: "asc" },
          },
          pickup_code: true,
        },
      });
    }
  } catch (err) {
    console.warn(`[OrderDetailPage] Could not query database for order ${id}:`, err);
  }

  if (!dbOrder || dbOrder.seller_id !== sellerId) {
    notFound();
    return null;
  }

  const order = dbOrder;

  const totalFormatted = formatBirr(order.total_santim ?? 0);
  const maskedPhone = maskPhoneNumber(order.buyer_phone || "");

  const steps = [
    { key: "new", label: "Placed" },
    { key: "accepted", label: "Accepted" },
    { key: "ready", label: "Ready" },
    { key: "completed", label: "Completed" },
  ];

  const stateOrder = ["new", "accepted", "ready", "completed"];
  const currentIdx = stateOrder.indexOf(order.state);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-sm text-slate-500">
        <Link
          href="/dashboard"
          className="hover:text-slate-900 transition flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Orders</span>
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-800">{`Order #${order.number}`}</span>
      </nav>

      {/* Main Order Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {`Order #${order.number}`}
            </h1>
            {getStatusBadge(order.state)}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            {`ID: ${order.id}`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Total Amount</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {totalFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Lifecycle Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4">
          Order Lifecycle Status
        </h2>

        {order.state === "rejected" ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <div className="text-sm">
              <span className="font-semibold">Order Rejected</span> — This order was declined and will not proceed to fulfillment.
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
                        : "bg-slate-100 text-slate-400 border border-slate-300"
                    }`}
                  >
                    {isPassed ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      isCurrent
                        ? "text-slate-900 font-bold"
                        : isPassed
                        ? "text-slate-700"
                        : "text-slate-400"
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">
                {`Order Items (${order.order_items?.length || 0})`}
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {order.order_items?.map((item: any) => {
                const unitFormatted = formatBirr(item.unit_price_santim);
                const lineFormatted = formatBirr(item.unit_price_santim * item.quantity);
                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900 text-sm">
                        {item.name_at_order}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {`${item.quantity} × ${unitFormatted}`}
                      </p>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm">
                      {lineFormatted}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between font-bold text-base text-slate-900">
              <span>Grand Total</span>
              <span>{totalFormatted}</span>
            </div>
          </div>

          {/* State Transition History Timeline (Acceptance Criterion 2, FR-17) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
              <History className="w-4 h-4 text-emerald-600" />
              <h2>State Transition Audit History</h2>
            </div>

            {order.order_events && order.order_events.length > 0 ? (
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {order.order_events.map((evt: any) => (
                  <div key={evt.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-slate-900 uppercase">
                          {evt.from_state ? `${evt.from_state} → ${evt.to_state}` : `Created as ${evt.to_state}`}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {evt.actor}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(evt.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No transition events recorded yet.
              </p>
            )}
          </div>

          {/* SMS Audit Trail (Acceptance Criterion 3, FR-17, Invariant #8) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-semibold text-sm">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h2>SMS Notifications Audit Log</h2>
            </div>

            {order.messages && order.messages.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">Event</th>
                      <th className="py-2 px-3">Recipient</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {order.messages.map((msg: any) => (
                      <tr key={msg.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                          {msg.event}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {maskPhoneNumber(msg.recipient_phone || msg.phone || "")}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              msg.status === "sent" || msg.status === "test_passed"
                                ? "bg-emerald-100 text-emerald-800"
                                : msg.status === "failed"
                                ? "bg-rose-100 text-rose-800"
                                : msg.status === "skipped"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {msg.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatDateTime(msg.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No SMS audit log records recorded for this order yet.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Order Actions & Customer Info */}
        <div className="space-y-6">
          {/* Action Buttons Component (Acceptance Criterion 4, FR-18, FR-20) */}
          <OrderActions
            orderId={order.id}
            initialState={order.state}
          />

          {/* Customer Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Customer Information
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="font-medium text-slate-900">
                  {order.buyer_name || "Guest Customer"}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a
                  href={`tel:${order.buyer_phone}`}
                  className="font-mono text-emerald-600 hover:underline"
                >
                  {maskedPhone}
                </a>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>
                  {order.sms_consent ? "SMS Consent Granted" : "No SMS Consent"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
