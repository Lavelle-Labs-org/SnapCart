import React from "react";
import Link from "next/link";
import { CheckCircle2, Home, MessageSquare, Store } from "lucide-react";
import { prisma } from "../../../../lib/prisma";

interface DonePageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    orderId?: string;
    orderNumber?: string;
    consent?: string;
    smsConsent?: string;
  }>;
}

export default async function DonePage({ params, searchParams }: DonePageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const queryOrderId = resolvedSearchParams?.orderId;
  const queryOrderNumber = resolvedSearchParams?.orderNumber;
  const queryConsent = resolvedSearchParams?.consent ?? resolvedSearchParams?.smsConsent;

  // 1. Fetch order details if orderId is provided (without exposing PII)
  let orderData: {
    number: number;
    smsConsent: boolean;
    shopName?: string;
  } | null = null;

  if (queryOrderId) {
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
  if (!shopName && slug) {
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between max-w-md mx-auto border-x border-slate-200 p-6 text-center">
      <div className="flex-1 flex flex-col justify-center items-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Order Placed!</h1>
          {shopName && (
            <p className="text-sm font-medium text-slate-500">{`at ${shopName}`}</p>
          )}
        </div>

        <div
          data-testid="order-number"
          className="inline-block bg-slate-100 px-5 py-2 rounded-full text-base font-bold text-slate-800 tracking-wide"
        >
          {`Order #${displayOrderNumber}`}
        </div>

        {hasConsented ? (
          <>
            <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
              The seller has been notified via SMS. You will receive text updates
              when your order is accepted and ready for pickup.
            </p>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 text-left flex items-start space-x-3 w-full mt-4">
              <MessageSquare className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Pickup Code via SMS:</span>
                When the seller marks this order ready, you will receive a 4-digit
                code to present at handover.
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600 max-w-xs leading-relaxed">
              The seller has been notified. You opted out of SMS updates, so text
              notifications are turned off.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 text-left flex items-start space-x-3 w-full mt-4">
              <Store className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Check with Seller:</span>
                Since you opted out of SMS updates, please check with the seller
                directly or present your order number at the counter for status
                and pickup.
              </div>
            </div>
          </>
        )}
      </div>

      <div className="pt-6">
        <Link
          href={`/s/${slug}`}
          className="w-full flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-3 rounded-xl transition shadow-sm"
        >
          <Home className="w-4 h-4" />
          <span>Back to Storefront</span>
        </Link>
      </div>
    </div>
  );
}
