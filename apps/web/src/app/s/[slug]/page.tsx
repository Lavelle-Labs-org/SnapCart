import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { StorefrontCatalog } from "./storefront-catalog";

interface StorefrontPageProps {
  params: Promise<{ slug: string }>;
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  // 1. Query seller by slug from database
  let seller = null;
  let products: Array<{
    id: string;
    name: string;
    price_santim: number;
    available: boolean;
  }> = [];

  try {
    seller = await prisma.seller.findUnique({
      where: { slug },
      select: {
        id: true,
        business_name: true,
        sms_name: true,
        slug: true,
      },
    });

    if (!seller) {
      notFound();
    }

    // 2. Query available products (available: true, deleted_at: null)
    products = await prisma.product.findMany({
      where: {
        seller_id: seller.id,
        available: true,
        deleted_at: null,
      },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        name: true,
        price_santim: true,
        available: true,
        image_url: true,
      },
    });
  } catch (err: any) {
    // If notFound() threw NEXT_NOT_FOUND, let Next.js handle it
    if (err?.digest?.includes("NEXT_NOT_FOUND")) {
      throw err;
    }

    // Fallback: If direct DB access is unavailable, fetch from API
    try {
      const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/s/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });

      if (res.status === 404) {
        notFound();
      }

      if (!res.ok) {
        notFound();
      }

      const body = await res.json();
      const data = body.data || body;

      return (
        <StorefrontCatalog
          seller={{
            id: data.seller.id,
            businessName: data.seller.businessName,
            smsName: data.seller.smsName,
            slug: data.seller.slug,
          }}
          products={(data.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            priceSantim: p.priceSantim ?? p.price_santim,
            available: p.available,
            imageUrl: p.imageUrl ?? p.image_url ?? null,
          }))}
        />
      );
    } catch (fallbackErr: any) {
      if (fallbackErr?.digest?.includes("NEXT_NOT_FOUND")) {
        throw fallbackErr;
      }
      notFound();
    }
  }

  return (
    <StorefrontCatalog
      seller={{
        id: seller.id,
        businessName: seller.business_name,
        smsName: seller.sms_name,
        slug: seller.slug,
      }}
      products={products.map((p: any) => ({
        id: p.id,
        name: p.name,
        priceSantim: p.price_santim,
        available: p.available,
        imageUrl: p.image_url ?? p.imageUrl ?? null,
      }))}
    />
  );
}
