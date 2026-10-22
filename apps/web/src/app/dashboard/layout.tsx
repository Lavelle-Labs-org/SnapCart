import React from "react";
import Link from "next/link";
import {
  MessageSquare,
  ShoppingBag,
  ListOrdered,
  Mail,
  Settings,
  LogOut,
  Store,
} from "lucide-react";
import { prisma } from "../../lib/prisma";
import { extractSellerIdFromToken } from "./dashboard-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let seller: { business_name?: string; slug?: string } | null = null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("seller_session")?.value;
    if (token) {
      const sellerId = extractSellerIdFromToken(token);
      if (sellerId && prisma?.seller?.findUnique) {
        seller = await prisma.seller.findUnique({
          where: { id: sellerId },
          select: { business_name: true, slug: true },
        });
      }
    }
  } catch {
    // Outside request context
  }

  const displayName = seller?.business_name || "Order-by-SMS";
  const displaySubtitle = seller?.slug ? `@${seller.slug}` : "Seller Portal";

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col justify-between">
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
            <div className="bg-emerald-500 text-white p-2 rounded-lg flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-base block truncate" title={displayName}>
                {displayName}
              </span>
              <span className="text-xs text-slate-400 block truncate">
                {displaySubtitle}
              </span>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <ListOrdered className="w-5 h-5 text-emerald-400" />
              <span>Orders</span>
            </Link>

            <Link
              href="/dashboard/messages"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <Mail className="w-5 h-5 text-blue-400" />
              <span>SMS Message Log</span>
            </Link>

            <Link
              href="/dashboard/products"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <span>Products</span>
            </Link>

            <Link
              href="/dashboard/settings"
              className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-200 transition"
            >
              <Settings className="w-5 h-5 text-purple-400" />
              <span>Settings & Link</span>
            </Link>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <Link
            href="/login"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Seller Dashboard</h2>
            {seller?.business_name && (
              <p className="text-xs text-slate-500">{seller.business_name}</p>
            )}
          </div>
          <div className="flex items-center space-x-3 text-xs">
            {seller?.slug && (
              <a
                href={`/c/${seller.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full font-medium transition"
              >
                <Store className="w-3.5 h-3.5" />
                <span>View Storefront</span>
              </a>
            )}
            <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-medium border border-emerald-200">
              SMSHub Mode: Test
            </span>
          </div>
        </header>

        <main className="p-6 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
