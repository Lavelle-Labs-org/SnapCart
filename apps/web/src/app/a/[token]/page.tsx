import React from "react";
import Link from "next/link";
import crypto from "crypto";
import { AlertCircle, ArrowRight } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { toBirr } from "@order-by-sms/contracts";
import { SellerActionClient, ActionOrderData } from "./action-client";

interface ActionPageProps {
  params: Promise<{ token: string }>;
}

export default async function ActionPage({ params }: ActionPageProps) {
  const { token } = await params;

  if (!token || typeof token !== "string") {
    return renderInvalidTokenView();
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  let tokenRecord = null;
  try {
    tokenRecord = await prisma.actionToken.findUnique({
      where: { token_hash: tokenHash },
      include: {
        order: {
          include: {
            seller: true,
            order_items: true,
          },
        },
      },
    });
  } catch (dbErr) {
    // Fallback: If direct DB access is unavailable, fetch from API
    try {
      const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/a/${encodeURIComponent(token)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        return renderInvalidTokenView();
      }

      const body = await res.json();
      const orderDto = body.data || body;

      const orderData: ActionOrderData = {
        id: orderDto.id,
        number: orderDto.number,
        buyerName: orderDto.buyerName,
        buyerPhone: orderDto.buyerPhone,
        smsConsent: Boolean(orderDto.smsConsent),
        state: orderDto.state,
        totalBirr: toBirr(orderDto.totalSantim),
        items: (orderDto.items || []).map((item: any) => ({
          id: item.id,
          name: item.nameAtOrder,
          quantity: item.quantity,
          priceBirr: toBirr(item.unitPriceSantim),
        })),
        shopName: orderDto.seller?.smsName || orderDto.seller?.businessName,
      };

      return <SellerActionClient token={token} order={orderData} />;
    } catch {
      return renderInvalidTokenView();
    }
  }

  // Validate token freshness & validity
  if (!tokenRecord || !tokenRecord.order) {
    return renderInvalidTokenView();
  }

  if (tokenRecord.purpose !== "seller_action") {
    return renderInvalidTokenView();
  }

  if (tokenRecord.expires_at < new Date()) {
    return renderInvalidTokenView("This link has expired (links are valid for 48 hours).");
  }

  if (tokenRecord.revoked_at !== null) {
    return renderInvalidTokenView("This link has already been used or completed.");
  }

  const order = tokenRecord.order;
  const formattedOrder: ActionOrderData = {
    id: order.id,
    number: order.number,
    buyerName: order.buyer_name,
    buyerPhone: order.buyer_phone,
    smsConsent: order.sms_consent,
    state: order.state as any,
    totalBirr: toBirr(order.total_santim),
    items: (order.order_items || []).map((item: any) => ({
      id: item.id,
      name: item.name_at_order,
      quantity: item.quantity,
      priceBirr: toBirr(item.unit_price_santim),
    })),
    shopName: order.seller?.sms_name || order.seller?.business_name,
  };

  return <SellerActionClient token={token} order={formattedOrder} />;
}

function renderInvalidTokenView(reason?: string) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center max-w-md mx-auto border-x border-slate-200">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm w-full space-y-4">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900">Invalid or Expired Link</h1>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {reason ||
              "This seller order link is no longer valid, has expired, or has already been used."}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="w-full inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 rounded-xl transition text-sm min-h-[44px] shadow-xs"
          >
            <span>Go to Seller Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
