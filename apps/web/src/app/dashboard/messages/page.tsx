import React from "react";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { extractSellerIdFromToken } from "../dashboard-helpers";
import MessagesClient, { MessageItem } from "./messages-client";

export interface MessagesPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Seller Messages Audit Log Server Page (FE-012, FR-26, FR-28, FR-29).
 * Loads live message audit records from the database for the authenticated seller,
 * detects system pause and balance flags, and passes them to the interactive MessagesClient.
 */
export default async function MessagesLogPage({ searchParams }: MessagesPageProps) {
  let sellerId: string | null = null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("seller_session")?.value;
    if (token) {
      sellerId = extractSellerIdFromToken(token);
    }
  } catch {
    // Outside active request context (e.g. testing or static export)
  }

  let resolvedParams: { [key: string]: string | string[] | undefined } | undefined;
  if (searchParams) {
    try {
      resolvedParams = await searchParams;
      if (!sellerId && typeof resolvedParams?.sellerId === "string") {
        sellerId = resolvedParams.sellerId;
      }
    } catch {
      // Ignore resolution errors
    }
  }

  if (!sellerId) {
    redirect("/login");
  }

  let dbMessages: any[] = [];
  try {
    if (prisma?.message?.findMany) {
      dbMessages = await prisma.message.findMany({
        where: {
          OR: [
            { seller_id: sellerId },
            { order: { seller_id: sellerId } },
          ],
        },
        orderBy: { created_at: "desc" },
      });
    }
  } catch (err) {
    console.warn("[MessagesLogPage] Could not query database for messages:", err);
  }

  const isSendingPaused =
    process.env.SMS_SENDING_PAUSED?.toLowerCase() === "true" ||
    resolvedParams?.sendingPaused === "true";

  const isLowBalance =
    process.env.SMS_BALANCE_LOW?.toLowerCase() === "true" ||
    resolvedParams?.lowBalance === "true";

  const initialMessages: MessageItem[] = dbMessages.map((m) => ({
    id: m.id,
    sellerId: m.seller_id ?? null,
    orderId: m.order_id ?? null,
    recipientPhone: m.recipient_phone,
    event: m.event,
    text: m.text,
    status: m.status,
    skipReason: m.skip_reason ?? null,
    smshubMessageId: m.smshub_message_id ?? null,
    requestId: m.request_id ?? null,
    network: m.network ?? null,
    creditsUsed: m.credits_used ?? null,
    errorType: m.error_type ?? null,
    attempts: m.attempts ?? 0,
    createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    updatedAt: m.updated_at ? new Date(m.updated_at).toISOString() : new Date().toISOString(),
  }));

  return (
    <MessagesClient
      initialMessages={initialMessages}
      isSendingPaused={isSendingPaused}
      isLowBalance={isLowBalance}
    />
  );
}
