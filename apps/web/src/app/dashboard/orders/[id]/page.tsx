import React from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { extractSellerIdFromToken } from "../../dashboard-helpers";
import { OrderDetailClient } from "./order-detail-client";
import OrderActions from "./order-actions";

export interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Seller Order Detail Page (FE-010, FR-17, FR-18, FR-20).
 * Handles authentication, DB query with API fallback, and IDOR protection on server,
 * delegating interactive presentation to reactive OrderDetailClient for immediate i18n switching.
 */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;

  let sellerId: string | null = null;
  let token: string | undefined;
  let isAmharic = false;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    token = cookieStore.get("seller_session")?.value;
    const localeCookie = cookieStore.get("obs_locale")?.value;
    isAmharic = localeCookie === "am";
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
  let prismaSucceeded = false;

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
      prismaSucceeded = true;
    }
  } catch (err) {
    console.warn(`[OrderDetailPage] Could not query database for order ${id} via Prisma:`, err);
  }

  // Fallback to internal NestJS API if Prisma direct connection failed or DATABASE_URL is omitted (PR-010)
  if (!prismaSucceeded && token) {
    try {
      const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/orders/${encodeURIComponent(id)}`, {
        headers: {
          Cookie: `seller_session=${token}`,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });
      if (res.ok) {
        const body = await res.json();
        const o = body?.data ?? body;
        if (o) {
          dbOrder = {
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
            order_items: (o.items ?? o.order_items ?? []).map((it: any) => ({
              id: it.id,
              name_at_order: it.name_at_order ?? it.nameAtOrder ?? "",
              unit_price_santim: it.unit_price_santim ?? it.unitPriceSantim ?? 0,
              quantity: it.quantity ?? 1,
            })),
            order_events: (o.events ?? o.order_events ?? []).map((ev: any) => ({
              id: ev.id,
              from_state: ev.from_state ?? ev.fromState,
              to_state: ev.to_state ?? ev.toState,
              actor: ev.actor,
              created_at: ev.created_at ?? ev.createdAt,
            })),
            messages: (o.messages ?? []).map((m: any) => ({
              id: m.id,
              event: m.event,
              recipient_phone: m.recipient_phone ?? m.recipientPhone,
              status: m.status,
              created_at: m.created_at ?? m.createdAt,
            })),
          };
        }
      }
    } catch (err) {
      console.warn(`[OrderDetailPage] Could not query order via API:`, err);
    }
  }

  if (!dbOrder || dbOrder.seller_id !== sellerId) {
    notFound();
    return null;
  }

  const serializedOrder = {
    id: dbOrder.id,
    seller_id: dbOrder.seller_id,
    number: dbOrder.number,
    buyer_name: dbOrder.buyer_name,
    buyer_phone: dbOrder.buyer_phone,
    sms_consent: Boolean(dbOrder.sms_consent),
    consent_wording: dbOrder.consent_wording,
    consent_at: dbOrder.consent_at ? new Date(dbOrder.consent_at).toISOString() : null,
    state: dbOrder.state,
    total_santim: dbOrder.total_santim ?? 0,
    created_at: dbOrder.created_at ? new Date(dbOrder.created_at).toISOString() : new Date().toISOString(),
    order_items: (dbOrder.order_items ?? []).map((it: any) => ({
      id: it.id,
      name_at_order: it.name_at_order,
      unit_price_santim: it.unit_price_santim ?? 0,
      quantity: it.quantity ?? 1,
    })),
    order_events: (dbOrder.order_events ?? []).map((ev: any) => ({
      id: ev.id,
      from_state: ev.from_state,
      to_state: ev.to_state,
      actor: ev.actor,
      created_at: ev.created_at ? new Date(ev.created_at).toISOString() : new Date().toISOString(),
    })),
    messages: (dbOrder.messages ?? []).map((m: any) => ({
      id: m.id,
      event: m.event,
      recipient_phone: m.recipient_phone,
      phone: m.phone,
      status: m.status,
      created_at: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    })),
  };

  return (
    <OrderDetailClient order={serializedOrder} initialLocale={isAmharic ? "am" : "en"}>
      <OrderActions orderId={serializedOrder.id} initialState={serializedOrder.state} />
    </OrderDetailClient>
  );
}
