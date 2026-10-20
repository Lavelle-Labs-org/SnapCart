import React from "react";
import crypto from "crypto";
import { prisma } from "../../../lib/prisma";
import { OptOutClient, OptOutPreviewData } from "./opt-out-client";

interface StopTextsProps {
  params: Promise<{ token: string }>;
}

export default async function StopTextsPage({ params }: StopTextsProps) {
  const { token } = await params;

  let previewData: OptOutPreviewData | null = null;

  if (token && typeof token === "string") {
    try {
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      const tokenRecord = await prisma.actionToken.findUnique({
        where: { token_hash: tokenHash },
        include: {
          order: {
            include: {
              seller: true,
            },
          },
        },
      });

      if (
        tokenRecord &&
        tokenRecord.purpose === "buyer_stop" &&
        tokenRecord.order
      ) {
        const normalizedPhone = tokenRecord.order.buyer_phone;
        const suppression = await prisma.suppressionList.findUnique({
          where: { phone: normalizedPhone },
        });

        previewData = {
          orderNumber: tokenRecord.order.number,
          shopName:
            tokenRecord.order.seller?.sms_name ||
            tokenRecord.order.seller?.business_name,
          alreadySuppressed: !!suppression,
        };
      }
    } catch {
      // Fallback gracefully: OptOutClient still handles submission directly
    }
  }

  return <OptOutClient token={token} initialData={previewData} />;
}
