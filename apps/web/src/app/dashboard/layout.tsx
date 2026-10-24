import React from "react";
import { Store } from "lucide-react";
import { prisma } from "../../lib/prisma";
import { extractSellerIdFromToken } from "./dashboard-helpers";
import { DashboardShell } from "./dashboard-shell";

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
      const sellerId = await extractSellerIdFromToken(token);
      if (sellerId && prisma?.seller?.findUnique) {
        try {
          seller = await prisma.seller.findUnique({
            where: { id: sellerId },
            select: { business_name: true, slug: true },
          });
        } catch {
          // Prisma query failed
        }
      }

      if (!seller) {
        try {
          const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
          const res = await fetch(`${apiUrl}/api/auth/me`, {
            headers: {
              Cookie: `seller_session=${token}`,
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          });
          if (res.ok) {
            const body = await res.json();
            const s = body?.data?.seller || body?.seller;
            if (s) {
              seller = { business_name: s.business_name, slug: s.slug };
            }
          }
        } catch {
          // API query failed
        }
      }
    }
  } catch {
    // Outside request context
  }

  const displayName = seller?.business_name || "Order-by-SMS";
  const displaySubtitle = seller?.slug ? `@${seller.slug}` : "Seller Portal";

  return (
    <DashboardShell
      seller={seller}
      displayName={displayName}
      displaySubtitle={displaySubtitle}
    >
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 leading-snug">Seller Dashboard</h2>
          {seller?.business_name && (
            <p className="text-xs text-slate-500">
              <span>{seller.business_name}</span>
              {seller.slug && <span className="ml-1.5 text-slate-400">{`@${seller.slug}`}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3 text-xs">
          {seller?.slug && (
            <a
              href={`/s/${seller.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-full font-medium transition"
            >
              <Store className="w-3.5 h-3.5" />
              <span>View Storefront</span>
            </a>
          )}
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>SMSHub Mode: Test</span>
          </span>
        </div>
      </header>

      <main className="p-4 md:p-6 flex-1 overflow-y-auto">{children}</main>
    </DashboardShell>
  );
}
