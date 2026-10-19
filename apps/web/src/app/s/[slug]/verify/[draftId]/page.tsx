import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "../../../../../lib/prisma";
import { VerifyOtpForm } from "./verify-form";

interface VerifyPageProps {
  params: Promise<{ slug: string; draftId: string }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { slug, draftId } = await params;

  if (!slug || !draftId) {
    notFound();
  }

  let seller = null;
  let verification = null;

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

    verification = await prisma.phoneVerification.findUnique({
      where: { id: draftId },
      select: {
        id: true,
        phone: true,
        purpose: true,
        status: true,
        last_sent_at: true,
        expires_at: true,
      },
    });

    if (!verification || verification.purpose !== "buyer_checkout") {
      notFound();
    }
  } catch (err: any) {
    if (err?.digest?.includes("NEXT_NOT_FOUND")) {
      throw err;
    }

    // Fallback: If direct DB access is unavailable, fetch seller from API
    try {
      const apiUrl = process.env.INTERNAL_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/api/s/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        notFound();
      }

      return (
        <VerifyOtpForm
          slug={slug}
          draftId={draftId}
          phone="Your Phone Number"
          lastSentAt={new Date().toISOString()}
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
    <VerifyOtpForm
      slug={slug}
      draftId={draftId}
      phone={verification.phone}
      lastSentAt={
        verification.last_sent_at
          ? verification.last_sent_at.toISOString()
          : null
      }
    />
  );
}
