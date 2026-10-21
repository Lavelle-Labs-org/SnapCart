import React from "react";
import { prisma } from "../../../lib/prisma";
import { extractSellerIdFromToken } from "../dashboard-helpers";
import SettingsClient, { SellerSettingsData } from "./settings-client";

export interface SettingsPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Shop Settings Server Component (FE-013, Issue #36).
 * Loads authenticated seller profile from PostgreSQL via Prisma,
 * and renders interactive settings form with real-time character counter
 * and live SMS template previewer.
 */
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
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
      // Ignore resolution errors
    }
  }

  let dbSeller: any = null;
  try {
    if (prisma?.seller?.findFirst) {
      if (sellerId) {
        dbSeller = await prisma.seller.findUnique({
          where: { id: sellerId },
        });
      }
      if (!dbSeller) {
        // Fallback to demo seller if not authenticated or in preview
        dbSeller = await prisma.seller.findFirst({
          where: { slug: "habesha-cafe" },
        });
        if (!dbSeller) {
          dbSeller = await prisma.seller.findFirst({
            orderBy: { created_at: "asc" },
          });
        }
      }
    }
  } catch (err) {
    console.warn("[SettingsPage] Could not query database for seller:", err);
  }

  const initialSeller: SellerSettingsData = {
    id: dbSeller?.id || "demo-seller-id",
    businessName: dbSeller?.business_name || "Habesha Cafe & Bakery",
    smsName: dbSeller?.sms_name || "Habesha Cafe",
    slug: dbSeller?.slug || "habesha-cafe",
    phone: dbSeller?.phone || "+251911223344",
  };

  return <SettingsClient initialSeller={initialSeller} />;
}
