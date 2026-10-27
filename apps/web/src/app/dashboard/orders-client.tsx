"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { formatBirr, maskPhoneNumber } from "@order-by-sms/contracts";
import { formatOrderTime, getStatusBadge } from "./dashboard-helpers";
import { useTranslation, en, am } from "../../lib/i18n";

export interface OrdersClientProps {
  initialOrders: any[];
  initialLocale?: "en" | "am";
}

export function OrdersClient({ initialOrders, initialLocale }: OrdersClientProps) {
  const translation = useTranslation();
  // Prefer reactive context; fallback to initialLocale or "en" when outside Provider
  const isAmharic = translation?.isAmharic ?? (initialLocale === "am");
  const t = translation?.t ?? (isAmharic ? am : en);
  const orders = initialOrders || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {isAmharic ? t.orders.title : "Orders"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isAmharic ? t.orders.subtitle : "Live order queue and handover status."}
          </p>
        </div>
        {orders.length > 0 && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {isAmharic
                ? `${orders.length} ትዕዛዞች በሂደት ላይ`
                : `${orders.length} ${orders.length === 1 ? "order" : "orders"} live`}
            </span>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            {isAmharic ? t.orders.emptyTitle : "No orders yet"}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {isAmharic
              ? t.orders.emptyDesc
              : "When customers place orders from your storefront, they will appear here in real time. Share your shop link to start receiving orders!"}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
            >
              {isAmharic ? "የመደብር ሊንክ ይመልከቱ" : "View Storefront Link"}
            </Link>
            <Link
              href="/dashboard/products"
              className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              {isAmharic ? "እቃዎችን ያስተዳድሩ" : "Manage Products"}
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Mobile Stacked Card View (< md) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {orders.map((order) => {
              const maskedPhone = maskPhoneNumber(order.buyer_phone || "");
              const totalFormatted = formatBirr(order.total_santim ?? 0);
              const placedTime = formatOrderTime(order.created_at, isAmharic);

              return (
                <div key={`mobile-${order.id}`} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="font-bold text-slate-900 dark:text-slate-100 text-base hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                    >
                      {`#${order.number}`}
                    </Link>
                    {getStatusBadge(order.state, isAmharic)}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">{order.buyer_name || (isAmharic ? "እንግዳ ደንበኛ" : "Guest Customer")}</div>
                      <div className="text-slate-500 dark:text-slate-400 font-mono text-xs tabular-nums">{maskedPhone}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-base tabular-nums">{totalFormatted}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{placedTime}</div>
                    </div>
                  </div>
                  <div className="pt-1">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition"
                    >
                      <span>{isAmharic ? t.orders.viewDetails : "View Details"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">{isAmharic ? t.orders.colOrder : "Order #"}</th>
                  <th className="px-4 py-3">{isAmharic ? t.orders.colCustomer : "Customer"}</th>
                  <th className="px-4 py-3">{isAmharic ? t.orders.colPhone : "Phone"}</th>
                  <th className="px-4 py-3">{isAmharic ? t.orders.colTotal : "Total"}</th>
                  <th className="px-4 py-3">{isAmharic ? t.orders.colStatus : "Status"}</th>
                  <th className="px-4 py-3">{isAmharic ? t.orders.colPlaced : "Placed"}</th>
                  <th className="px-4 py-3 text-right">{isAmharic ? t.orders.colAction : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((order) => {
                  const maskedPhone = maskPhoneNumber(order.buyer_phone || "");
                  const totalFormatted = formatBirr(order.total_santim ?? 0);
                  const placedTime = formatOrderTime(order.created_at, isAmharic);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group cursor-pointer"
                    >
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                        >
                          {`#${order.number}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                        {order.buyer_name || (isAmharic ? "እንግዳ ደንበኛ" : "Guest Customer")}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-mono text-xs tabular-nums">
                        {maskedPhone}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {totalFormatted}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(order.state, isAmharic)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {placedTime}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 group-hover:underline"
                        >
                          <span>{isAmharic ? t.orders.viewDetails : "View Details"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersClient;
