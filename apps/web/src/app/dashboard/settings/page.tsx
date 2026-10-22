import React from "react";
import { redirect } from "next/navigation";
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
  let token: string | undefined;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    token = cookieStore.get("seller_session")?.value;
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

  if (!sellerId) {
    redirect("/login");
  }

  let dbSeller: any = null;
  if (sellerId && prisma?.seller?.findUnique) {
    try {
      dbSeller = await prisma.seller.findUnique({
        where: { id: sellerId },
      });
    } catch (err) {
      console.warn("[SettingsPage] Could not query database for seller via Prisma:", err);
    }
  }

  // Fallback: If Prisma direct connection is unavailable in serverless, fetch from NestJS API
  if (!dbSeller && token) {
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
        dbSeller = body?.data?.seller || body?.seller;
      }
    } catch (err) {
      console.warn("[SettingsPage] Could not fetch seller profile from API:", err);
    }
  }

  const initialSeller: SellerSettingsData = {
    id: dbSeller?.id || sellerId,
    businessName: dbSeller?.business_name || "My Cafe",
    smsName: dbSeller?.sms_name || dbSeller?.business_name || "My Cafe",
    slug: dbSeller?.slug || "my-cafe",
    phone: dbSeller?.phone || "+251900000000",
  };

  return <SettingsClient initialSeller={initialSeller} />;
}

