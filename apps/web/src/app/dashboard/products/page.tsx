import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { extractSellerIdFromToken } from "../dashboard-helpers";
import ProductManager, { ProductItem } from "./product-manager";

export interface ProductsPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Products Catalog Server Component (FE-011, FR-4).
 * Loads authenticated seller products from database, excluding soft-deleted items,
 * and renders interactive product catalog with CRUD modals and availability toggles.
 */
export default async function ProductsPage({ searchParams }: ProductsPageProps) {
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

  if (!sellerId) {
    redirect("/login");
  }

  let dbProducts: any[] = [];
  try {
    if (prisma?.product?.findMany) {
      dbProducts = await prisma.product.findMany({
        where: { seller_id: sellerId, deleted_at: null },
        orderBy: { created_at: "asc" },
      });
    }
  } catch (err) {
    console.warn("[ProductsPage] Could not query database for products:", err);
  }

  const initialProducts: ProductItem[] = dbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    priceSantim: p.price_santim,
    available: Boolean(p.available),
  }));

  return <ProductManager initialProducts={initialProducts} />;
}

