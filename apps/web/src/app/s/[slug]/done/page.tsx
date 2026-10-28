import React from "react";
import { prisma } from "../../../../lib/prisma";
import { isDemoStore } from "../../../../lib/demo-store";
import { DoneClient } from "./done-client";

interface DonePageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    orderId?: string;
    orderNumber?: string;
    consent?: string;
    smsConsent?: string;
    demo?: string;
  }>;
}

/**
 * Order Placed / Confirmation Server Component (FE-004, FR-16).
 * Handles server-side order resolution, demo decoupling, and delegates interactive
 * presentation to DoneClient for synchronous language reactivity.
 */
export default async function DonePage({ params, searchParams }: DonePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const queryOrderId = resolvedSearchParams?.orderId;
  const queryOrderNumber = resolvedSearchParams?.orderNumber;
  const queryConsent = resolvedSearchParams?.consent ?? resolvedSearchParams?.smsConsent;

  // 1. Pure demo store confirmation: zero database query needed
  let orderData: {
    number: number;
    smsConsent: boolean;
    shopName?: string;
  } | null = null;

  if (isDemoStore(slug) && (queryOrderId === "demo-ord-1001" || resolvedSearchParams?.demo === "true" || !queryOrderId)) {
    orderData = {
      number: queryOrderNumber ? parseInt(String(queryOrderNumber).replace(/^#/, ""), 10) || 1001 : 1001,
      smsConsent: queryConsent === "true" || queryConsent === "1",
      shopName: "Habesha Cafe & Bakery",
    };
  } else if (queryOrderId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: String(queryOrderId) },
        select: {
          number: true,
          sms_consent: true,
          seller: {
            select: {
              sms_name: true,
              business_name: true,
            },
          },
        },
      });

      if (order) {
        orderData = {
          number: order.number,
          smsConsent: order.sms_consent,
          shopName: order.seller?.sms_name || order.seller?.business_name,
        };
      }
    } catch {
      // Fallback gracefully on query error or mock-less environment
    }
  }

  // 2. Fetch seller details if shopName was not found via order
  let shopName = orderData?.shopName;
  if (!shopName && isDemoStore(slug)) {
    shopName = "Habesha Cafe & Bakery";
  } else if (!shopName && slug) {
    try {
      const seller = await prisma.seller.findUnique({
        where: { slug },
        select: {
          sms_name: true,
          business_name: true,
        },
      });
      if (seller) {
        shopName = seller.sms_name || seller.business_name;
      }
    } catch {
      // Fallback gracefully
    }
  }

  // 3. Determine assigned order number
  const rawOrderNumber =
    orderData?.number ??
    (queryOrderNumber ? String(queryOrderNumber).replace(/^#/, "") : 1001);
  const displayOrderNumber = String(rawOrderNumber);

  // 4. Determine buyer SMS consent state
  const hasConsented: boolean =
    orderData?.smsConsent !== undefined
      ? orderData.smsConsent
      : queryConsent !== undefined
      ? queryConsent === "true" || queryConsent === "1"
      : true;

  // 5. Determine initial locale from cookies if available
  let isAmharic = false;
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    isAmharic = cookieStore.get("obs_locale")?.value === "am";
  } catch {
    // Outside request context
  }

  return (
    <div className="min-h-[48px]">
      <DoneClient
        slug={slug}
        orderNumber={displayOrderNumber}
        hasConsented={hasConsented}
        shopName={shopName}
        initialLocale={isAmharic ? "am" : "en"}
      />
    </div>
  );
}
