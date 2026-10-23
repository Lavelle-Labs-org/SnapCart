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
  let token: string | undefined;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    token = cookieStore.get("seller_session")?.value;
    if (token) {
      sellerId = await extractSellerIdFromToken(token);
    }
  } catch {
    // Outside request context (e.g. testing or static build)
  }

  if (!sellerId) {
    redirect("/login");
  }

  let dbProducts: any[] = [];
  let prismaSucceeded = false;

  try {
    if (prisma?.product?.findMany) {
      dbProducts = await prisma.product.findMany({
        where: { seller_id: sellerId, deleted_at: null },
        orderBy: { created_at: "asc" },
      });
      prismaSucceeded = true;
    }
  } catch (err) {
    console.warn("[ProductsPage] Could not query database for products via Prisma:", err);
  }

  // Fallback to internal NestJS API if Prisma direct connection failed or DATABASE_URL is omitted (PR-010)
  if (!prismaSucceeded && token) {
    try {
      const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/products`, {
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
          dbProducts = items.map((p: any) => ({
            id: p.id,
            name: p.name,
            price_santim: p.price_santim ?? p.priceSantim,
            available: p.available,
          }));
        }
      }
    } catch (err) {
      console.warn("[ProductsPage] Could not query products via API:", err);
    }
  }

  const initialProducts: ProductItem[] = dbProducts.map((p) => ({
    id: p.id,
    name: p.name,
    priceSantim: p.price_santim,
    available: Boolean(p.available),
  }));

  return <ProductManager initialProducts={initialProducts} />;
}

