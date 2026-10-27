import React from "react";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { extractSellerIdFromToken } from "./dashboard-helpers";
import { DashboardShell } from "./dashboard-shell";
import { DashboardHeader } from "./dashboard-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let seller: {
    business_name?: string;
    slug?: string;
    sms_credits?: number;
    sms_credits_used?: number;
  } | null = null;

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
            select: {
              business_name: true,
              slug: true,
              sms_credits: true,
              sms_credits_used: true,
            },
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
              seller = {
                business_name: s.business_name,
                slug: s.slug,
                sms_credits: s.sms_credits,
                sms_credits_used: s.sms_credits_used,
              };
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
      <DashboardHeader seller={seller} />
      <main className="p-4 md:p-6 flex-1 overflow-y-auto">{children}</main>
    </DashboardShell>
  );
}

