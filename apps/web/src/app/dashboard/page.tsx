import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { formatBirr, maskPhoneNumber } from "@order-by-sms/contracts";
import {
  OrdersDashboardPageProps,
  extractSellerIdFromToken,
  formatOrderTime,
  getStatusBadge,
} from "./dashboard-helpers";
import { en, am } from "../../lib/i18n";

/**
 * Orders Dashboard Server Component (FE-009, FR-16).
 * Loads signed-in seller orders from database sorted newest first,
 * with status badges, formatted ETB totals, masked buyer phones, and empty state.
 */
export default async function OrdersDashboardPage({
  searchParams,
}: OrdersDashboardPageProps) {
  let sellerId: string | null = null;
  let token: string | undefined;

  let isAmharic = false;
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    token = cookieStore.get("seller_session")?.value;
    if (token) {
      sellerId = await extractSellerIdFromToken(token);
    }
    isAmharic = cookieStore.get("obs_locale")?.value === "am";
  } catch {
    // Outside request context (e.g. testing or static build)
  }
  const t = isAmharic ? am : en;

  if (!sellerId) {
    redirect("/login");
  }

  let orders: any[] = [];
  let prismaSucceeded = false;

  try {
    if (prisma?.order?.findMany) {
      orders = await prisma.order.findMany({
        where: { seller_id: sellerId },
        include: {
          order_items: true,
        },
        orderBy: { created_at: "desc" },
      });
      prismaSucceeded = true;
    }
  } catch (err) {
    console.warn("[OrdersDashboardPage] Database order query failed via Prisma:", err);
  }

  // Fallback to internal NestJS API if Prisma direct connection failed or DATABASE_URL is omitted (PR-010)
  if (!prismaSucceeded && token) {
    try {
      const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/orders`, {
        headers: {
          Cookie: `seller_session=${token}`,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const body = await res.json();
        const items = body?.data ?? body;
        if (Array.isArray(items)) {
          orders = items.map((o: any) => ({
            id: o.id,
            seller_id: o.sellerId ?? o.seller_id,
            number: o.number,
            buyer_name: o.buyerName ?? o.buyer_name,
            buyer_phone: o.buyerPhone ?? o.buyer_phone,
            sms_consent: o.smsConsent ?? o.sms_consent,
            consent_wording: o.consentWording ?? o.consent_wording,
            consent_at: o.consentAt ?? o.consent_at,
            state: o.state,
            total_santim: o.totalSantim ?? o.total_santim,
            created_at: o.createdAt ?? o.created_at,
            order_items: o.items ?? o.order_items ?? [],
          }));
        }
      }
    } catch (err) {
      console.warn("[OrdersDashboardPage] Could not query orders via API:", err);
    }
  }

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
            <span>{isAmharic ? `${orders.length} ትዕዛዞች በሂደት ላይ` : `${orders.length} ${orders.length === 1 ? "order" : "orders"} live`}</span>
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
            {isAmharic ? t.orders.emptyDesc : "When customers place orders from your storefront, they will appear here in real time. Share your shop link to start receiving orders!"}
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
              const placedTime = formatOrderTime(order.created_at);

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
                  const placedTime = formatOrderTime(order.created_at);

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
