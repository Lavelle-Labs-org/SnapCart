import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import {
  OrdersDashboardPageProps,
  extractSellerIdFromToken,
} from "./dashboard-helpers";
import { OrdersClient } from "./orders-client";

/**
 * Orders Dashboard Server Component (FE-009, FR-16).
 * Loads signed-in seller orders from database sorted newest first,
 * delegating interactive rendering to reactive OrdersClient for instant i18n switching.
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
    <div className="overflow-x-auto">
      <OrdersClient initialOrders={orders} initialLocale={isAmharic ? "am" : "en"} />
    </div>
  );
}
