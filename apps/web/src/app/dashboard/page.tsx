import React from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { formatBirr, maskPhoneNumber } from "@order-by-sms/contracts";
import {
  OrdersDashboardPageProps,
  extractSellerIdFromToken,
  formatOrderTime,
  getStatusBadge,
} from "./dashboard-helpers";

/**
 * Orders Dashboard Server Component (FE-009, FR-16).
 * Loads signed-in seller orders from database sorted newest first,
 * with status badges, formatted ETB totals, masked buyer phones, and empty state.
 */
export default async function OrdersDashboardPage({
  searchParams,
}: OrdersDashboardPageProps) {
  let sellerId: string | null = null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("seller_session")?.value;
    if (token) {
      sellerId = extractSellerIdFromToken(token);
    }
  } catch {
    // Outside request context (e.g. testing or static build)
  }

  if (!sellerId && searchParams) {
    try {
      const resolved = await searchParams;
      if (typeof resolved?.sellerId === "string") {
        sellerId = resolved.sellerId;
      }
    } catch {
      // Ignore searchParams resolution errors
    }
  }

  let orders: any[] = [];
  try {
    if (prisma?.order?.findMany) {
      orders = await prisma.order.findMany({
        where: sellerId ? { seller_id: sellerId } : undefined,
        include: {
          order_items: true,
        },
        orderBy: { created_at: "desc" },
      });
    }
  } catch (err) {
    console.warn("[OrdersDashboardPage] Database order query failed:", err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500">Live order queue and handover status.</p>
        </div>
        {orders.length > 0 && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{`${orders.length} ${orders.length === 1 ? "order" : "orders"} live`}</span>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">No orders yet</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            When customers place orders from your storefront, they will appear here in real time. Share your shop link to start receiving orders!
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
            >
              View Storefront Link
            </Link>
            <Link
              href="/dashboard/products"
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition"
            >
              Manage Products
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const maskedPhone = maskPhoneNumber(order.buyer_phone || "");
                  const totalFormatted = formatBirr(order.total_santim ?? 0);
                  const placedTime = formatOrderTime(order.created_at);

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 transition group cursor-pointer"
                    >
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {`#${order.number}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-900">
                        {order.buyer_name || "Guest Customer"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-mono text-xs">
                        {maskedPhone}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-slate-900">
                        {totalFormatted}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(order.state)}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {placedTime}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800 group-hover:underline"
                        >
                          <span>View Details</span>
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
